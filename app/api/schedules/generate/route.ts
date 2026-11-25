import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import {
    isRoomCompatibleWithClassType,
    normalizeRoomUsageType,
    roomTypes,
    type RoomType,
} from '@/lib/rooms'
import { isScheduleDay, scheduleDays, type ScheduleAssignment, type ScheduleDay } from '@/lib/schedule'
import { getSchedulePolicy, getTimeMinutes } from '@/lib/schedule-policy'
import { rooms } from '@/model/room'
import { schedules } from '@/model/schedule'
import { users } from '@/model/user'

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const generatedScheduleSchema = z.object({
    assignments: z.array(z.object({
        id: z.string(),
        day: z.enum(scheduleDays),
        startTime: z.string().regex(timePattern),
        room: z.string(),
    }).strict()),
}).strict()

const geminiModelPattern = /^gemini-[A-Za-z0-9.-]+$/
const defaultGeminiModel = 'gemini-2.5-flash'

// Standard Philippine HEI / CHED scheduling reference windows (minutes since midnight)
const phLunchStart = 12 * 60 // 12:00 PM
const phLunchEnd = 13 * 60   // 1:00 PM
const phMaxConsecutiveMinutes = 180 // 3 hours max continuous teaching before a break
const phTthStandardStarts = new Set([
    7 * 60 + 30,  // 07:30 AM (7:30-9:00)
    9 * 60,       // 09:00 AM (9:00-10:30)
    10 * 60 + 30, // 10:30 AM (10:30-12:00)
    13 * 60,      // 01:00 PM (1:00-2:30)
    14 * 60 + 30, // 02:30 PM (2:30-4:00)
    16 * 60,      // 04:00 PM (4:00-5:30)
    17 * 60 + 30, // 05:30 PM (5:30-7:00)
])

function getMinutes(time: string) {
    const [hour, minute] = time.split(':').map(Number)
    return hour * 60 + minute
}

function formatMinutesToTime(totalMinutes: number) {
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
}

function getContinuousRunMinutes(
    existingIntervals: Array<{ start: number; end: number }>,
    candidateStart: number,
    candidateEnd: number,
) {
    const combined = [...existingIntervals, { start: candidateStart, end: candidateEnd }]
        .sort((a, b) => a.start - b.start)

    let runStart = combined[0].start
    let runEnd = combined[0].end
    let maxRun = runEnd - runStart

    for (let index = 1; index < combined.length; index += 1) {
        const current = combined[index]
        // Treat gaps under 15 minutes as continuous teaching without a meaningful break
        if (current.start - runEnd < 15) {
            runEnd = Math.max(runEnd, current.end)
        } else {
            runStart = current.start
            runEnd = current.end
        }
        maxRun = Math.max(maxRun, runEnd - runStart)
    }

    return maxRun
}

export async function POST() {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const apiKey = process.env.Geminus_API_KEY

    await connectDb()
    const [pendingClasses, scheduledClasses, roomRecords, schedulePolicy] = await Promise.all([
        schedules.find({ status: 'pending' }).sort({ createdAt: 1, _id: 1 }).lean(),
        schedules.find({
            $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
        }).sort({ day: 1, startTime: 1 }).lean(),
        rooms.find({}).select('name type').sort({ name: 1 }).lean(),
        getSchedulePolicy(),
    ])
    const scheduleStart = getTimeMinutes(schedulePolicy.dayStartTime)
    const scheduleEnd = getTimeMinutes(schedulePolicy.dayEndTime)
    if (pendingClasses.length === 0) {
        return NextResponse.json({ message: 'Add classes to the generation queue first.' }, { status: 400 })
    }
    if (roomRecords.length === 0) {
        return NextResponse.json({ message: 'Add at least one room to the room inventory before generating a schedule.' }, { status: 409 })
    }
    const classWithoutRoom = pendingClasses.find((record) => {
        const neededType: RoomType = record.classType === 'lab' ? 'lab' : 'lecture'
        return !roomRecords.some((room) => isRoomCompatibleWithClassType(room.type, neededType))
    })
    if (classWithoutRoom) {
        const typeLabel = classWithoutRoom.classType === 'lab' ? 'Lab' : 'Lecture'
        return NextResponse.json({
            message: `Add a ${typeLabel} room before generating ${classWithoutRoom.subject}.`,
        }, { status: 409 })
    }

    const roomLabels = new Map(roomRecords.map((room, index) => [room.name, `room-${index + 1}`]))
    const roomsByName = new Map(roomRecords.map((room) => [room.name, room]))
    const roomsByLabel = new Map(roomRecords.map((room, index) => [
        `room-${index + 1}`,
        { name: room.name, type: normalizeRoomUsageType(room.type) },
    ]))
    const invalidRoomPreference = pendingClasses.find((record) => {
        if (!record.preferredRoom) return false
        const room = roomsByName.get(record.preferredRoom)
        const neededType: RoomType = record.classType === 'lab' ? 'lab' : 'lecture'
        return !room || !isRoomCompatibleWithClassType(room.type, neededType)
    })
    if (invalidRoomPreference) {
        return NextResponse.json({
            message: `The selected room for ${invalidRoomPreference.subject} is no longer available or compatible. Edit the class and choose another room or automatic selection.`,
        }, { status: 409 })
    }

    const invalidPreferredDay = pendingClasses.find((record) => (
        record.preferredDay
        && !schedulePolicy.teachingDays.includes(record.preferredDay as ScheduleDay)
    ))
    if (invalidPreferredDay) {
        return NextResponse.json({
            message: `${invalidPreferredDay.subject} requires ${invalidPreferredDay.preferredDay}, which is disabled in Workspace Settings.`,
        }, { status: 409 })
    }

    const facultyIds = [...new Set([
        ...pendingClasses.map((record) => record.facultyId.toString()),
        ...scheduledClasses.map((record) => record.facultyId.toString()),
    ])]
    const faculty = await users.find({ _id: { $in: facultyIds }, role: 'user' }).select('name email').lean()
    const facultyById = new Map(faculty.map((member) => [member._id.toString(), member]))
    if (pendingClasses.some((record) => !facultyById.has(record.facultyId.toString()))) {
        return NextResponse.json({ message: 'A faculty member for a queued class could not be found.' }, { status: 409 })
    }

    const facultyLabels = new Map(facultyIds.map((id, index) => [id, `faculty-${index + 1}`]))
    const classLabels = new Map(pendingClasses.map((record, index) => [record._id.toString(), `class-${index + 1}`]))
    const model = process.env.Geminus_API_NAME?.trim()
    const modelName = model && geminiModelPattern.test(model) ? model : defaultGeminiModel
    const existing = scheduledClasses.map((record) => {
        const [startHour, startMinute] = (record.startTime ?? '').split(':').map(Number)
        const [endHour, endMinute] = (record.endTime ?? '').split(':').map(Number)

        const assignedRoomType = record.room ? normalizeRoomUsageType(roomsByName.get(record.room)?.type) : undefined
        const resolvedClassType: RoomType = record.classType === 'lab'
            ? 'lab'
            : record.classType === 'lecture'
                ? 'lecture'
                : assignedRoomType === 'lab'
                    ? 'lab'
                    : 'lecture'

        return {
            faculty: facultyLabels.get(record.facultyId.toString()),
            room: record.room ? roomLabels.get(record.room) : undefined,
            subject: record.subject,
            classType: resolvedClassType,
            roomType: assignedRoomType,
            day: record.day,
            startTime: record.startTime,
            endTime: record.endTime,
            start: startHour * 60 + startMinute,
            end: endHour * 60 + endMinute,
        }
    })
    if (existing.some((record) => (
        !record.faculty
        || !record.room
        || !roomTypes.includes(record.classType as RoomType)
        || !record.roomType
        || !isRoomCompatibleWithClassType(record.roomType, record.classType)
        || typeof record.day !== 'string'
        || !schedulePolicy.teachingDays.includes(record.day as ScheduleDay)
        || !record.startTime
        || !timePattern.test(record.startTime)
        || !record.endTime
        || !timePattern.test(record.endTime)
        || record.start < scheduleStart
        || record.end > scheduleEnd
        || record.start >= record.end
    ))) {
        return NextResponse.json({
            message: 'An existing class has invalid schedule data or no valid room. Edit the class and assign an available room before generating more classes.',
        }, { status: 409 })
    }

    function createFallbackAssignments() {
        const facultyIntervals = new Map<string, Array<{ start: number; end: number }>>()
        const roomIntervals = new Map<string, Array<{ start: number; end: number }>>()
        const facultySubjectDays = new Map<string, Set<string>>()

        for (const assignment of existing) {
            const interval = { start: assignment.start, end: assignment.end }
            const facultyKey = `${assignment.faculty}:${assignment.day}`
            facultyIntervals.set(facultyKey, [...(facultyIntervals.get(facultyKey) ?? []), interval])
            const roomKey = `${assignment.room}:${assignment.day}`
            roomIntervals.set(roomKey, [...(roomIntervals.get(roomKey) ?? []), interval])
            const subjectKey = `${assignment.faculty}:${assignment.subject}`
            const subjectDays = facultySubjectDays.get(subjectKey) ?? new Set<string>()
            subjectDays.add(assignment.day)
            facultySubjectDays.set(subjectKey, subjectDays)
        }

        // Group classes that share a Philippine meeting pattern (MWF, TTh, MW) so they synchronize time & room
        const groupedUnits = new Map<string, Array<(typeof pendingClasses)[number]>>()
        for (const record of pendingClasses) {
            const key = record.patternGroupId ? `group:${record.patternGroupId}` : `single:${record._id.toString()}`
            groupedUnits.set(key, [...(groupedUnits.get(key) ?? []), record])
        }

        // Schedule multi-day pattern groups first, then longer classes/labs, then shorter blocks
        const orderedGroups = [...groupedUnits.values()].sort((a, b) => {
            if (b.length !== a.length) return b.length - a.length
            return (b[0]?.durationMinutes ?? 0) - (a[0]?.durationMinutes ?? 0)
        })

        const hasWeekdays = schedulePolicy.teachingDays.some((day) => day !== 'Saturday')
        const canProtectLunch = scheduleStart < phLunchStart && scheduleEnd > phLunchEnd

        function scoreSlot(params: {
            day: ScheduleDay
            start: number
            durationMinutes: number
            classType: RoomType
            meetingPattern: string
            faculty: string
            subject: string
            roomType: string
            isGrouped: boolean
        }) {
            const { day, start, durationMinutes, classType, meetingPattern, faculty, subject, roomType, isGrouped } = params
            const end = start + durationMinutes
            let penalty = 0

            // 1. Strongly protect 12:00 PM - 1:00 PM lunch break
            if (canProtectLunch && start < phLunchEnd && end > phLunchStart) {
                penalty += 10_000
            }

            // 2. Respect standard Philippine CHED/HEI bell alignments
            if (durationMinutes === 90 || meetingPattern === 'TTh') {
                if (!phTthStandardStarts.has(start)) {
                    penalty += start % 30 === 0 ? 40 : 120
                }
            } else if (durationMinutes === 60 || meetingPattern === 'MWF' || meetingPattern === 'MW') {
                if (start % 60 !== 0) {
                    penalty += start % 30 === 0 ? 50 : 140
                }
            } else if (start % 60 !== 0) {
                penalty += start % 30 === 0 ? 20 : 100
            }

            // 3. Avoid exceeding 3 consecutive hours without a break for the faculty member
            const facultyDay = facultyIntervals.get(`${faculty}:${day}`) ?? []
            const maxContinuous = getContinuousRunMinutes(facultyDay, start, end)
            if (maxContinuous > phMaxConsecutiveMinutes) {
                penalty += 2_000 + (maxContinuous - phMaxConsecutiveMinutes) * 5
            }

            // 4. Prefer Monday-Friday for regular short classes; allow Saturday naturally for >=2.5h blocks
            if (!isGrouped && day === 'Saturday' && hasWeekdays && durationMinutes < 150) {
                penalty += 600
            }

            // 5. Avoid putting two single sessions of the same subject on the same day if avoidable
            if (!isGrouped && (facultySubjectDays.get(`${faculty}:${subject}`)?.has(day) ?? false)) {
                penalty += 500
            }

            // 6. Preserve dedicated Lecture/Lab rooms before consuming versatile 'both' rooms
            if (roomType === 'both' && classType === 'lecture') {
                penalty += 8
            }

            // 7. Balance faculty teaching minutes evenly across days
            const dayMinutes = facultyDay.reduce((sum, interval) => sum + (interval.end - interval.start), 0)
            penalty += Math.round(dayMinutes / 3)

            // 8. Prefer prime daytime academic hours (7:30 AM - 5:30 PM) before evening slots
            if (start < 7 * 60 + 30) penalty += 15
            if (end > 18 * 60) penalty += 35

            // Tie-breaker: earlier start time and earlier weekday
            penalty += start * 0.01 + scheduleDays.indexOf(day) * 0.5
            return penalty
        }

        const assignments: Array<{ id: string; day: ScheduleDay; startTime: string; room: string }> = []

        for (const group of orderedGroups) {
            const first = group[0]
            if (!first) continue

            const faculty = facultyLabels.get(first.facultyId.toString())
            const classType = first.classType ?? 'lecture'
            const meetingPattern = first.meetingPattern ?? 'single'
            const durationMinutes = first.durationMinutes
            if (!faculty) return null

            if (group.length > 1) {
                const requiredDays: ScheduleDay[] = []
                for (const item of group) {
                    if (!isScheduleDay(item.preferredDay) || !schedulePolicy.teachingDays.includes(item.preferredDay)) {
                        return null
                    }
                    requiredDays.push(item.preferredDay)
                }

                let bestCandidate: { start: number; room: string; score: number } | undefined

                for (let start = scheduleStart; start + durationMinutes <= scheduleEnd; start += 15) {
                    const end = start + durationMinutes
                    for (const [roomLabel, room] of roomsByLabel) {
                        if (!isRoomCompatibleWithClassType(room.type, classType)) continue
                        if (first.preferredRoom && room.name !== first.preferredRoom) continue

                        const hasConflict = requiredDays.some((day) => {
                            const facultyDay = facultyIntervals.get(`${faculty}:${day}`) ?? []
                            const roomDay = roomIntervals.get(`${roomLabel}:${day}`) ?? []
                            return (
                                facultyDay.some((interval) => start < interval.end && end > interval.start)
                                || roomDay.some((interval) => start < interval.end && end > interval.start)
                            )
                        })
                        if (hasConflict) continue

                        const groupScore = requiredDays.reduce(
                            (sum, day) => sum + scoreSlot({
                                day,
                                start,
                                durationMinutes,
                                classType,
                                meetingPattern,
                                faculty,
                                subject: first.subject,
                                roomType: room.type,
                                isGrouped: true,
                            }),
                            0,
                        )

                        if (!bestCandidate || groupScore < bestCandidate.score) {
                            bestCandidate = { start, room: roomLabel, score: groupScore }
                        }
                    }
                }

                if (!bestCandidate) return null

                const end = bestCandidate.start + durationMinutes
                const startTime = formatMinutesToTime(bestCandidate.start)
                for (const item of group) {
                    const id = classLabels.get(item._id.toString())
                    const day = item.preferredDay as ScheduleDay
                    if (!id) return null

                    const interval = { start: bestCandidate.start, end }
                    const facultyKey = `${faculty}:${day}`
                    facultyIntervals.set(facultyKey, [...(facultyIntervals.get(facultyKey) ?? []), interval])
                    const roomKey = `${bestCandidate.room}:${day}`
                    roomIntervals.set(roomKey, [...(roomIntervals.get(roomKey) ?? []), interval])

                    const subjectKey = `${faculty}:${item.subject}`
                    const subjectDays = facultySubjectDays.get(subjectKey) ?? new Set<string>()
                    subjectDays.add(day)
                    facultySubjectDays.set(subjectKey, subjectDays)

                    assignments.push({
                        id,
                        day,
                        startTime,
                        room: bestCandidate.room,
                    })
                }
            } else {
                const id = classLabels.get(first._id.toString())
                if (!id) return null

                const candidateDays = isScheduleDay(first.preferredDay)
                    ? [first.preferredDay]
                    : schedulePolicy.teachingDays

                let bestCandidate: { day: ScheduleDay; start: number; room: string; score: number } | undefined

                for (const day of candidateDays) {
                    for (let start = scheduleStart; start + durationMinutes <= scheduleEnd; start += 15) {
                        const end = start + durationMinutes
                        for (const [roomLabel, room] of roomsByLabel) {
                            if (!isRoomCompatibleWithClassType(room.type, classType)) continue
                            if (first.preferredRoom && room.name !== first.preferredRoom) continue

                            const facultyDay = facultyIntervals.get(`${faculty}:${day}`) ?? []
                            const roomDay = roomIntervals.get(`${roomLabel}:${day}`) ?? []
                            if (
                                facultyDay.some((interval) => start < interval.end && end > interval.start)
                                || roomDay.some((interval) => start < interval.end && end > interval.start)
                            ) continue

                            const slotScore = scoreSlot({
                                day,
                                start,
                                durationMinutes,
                                classType,
                                meetingPattern,
                                faculty,
                                subject: first.subject,
                                roomType: room.type,
                                isGrouped: false,
                            })

                            if (!bestCandidate || slotScore < bestCandidate.score) {
                                bestCandidate = { day, start, room: roomLabel, score: slotScore }
                            }
                        }
                    }
                }

                if (!bestCandidate) return null

                const end = bestCandidate.start + durationMinutes
                const interval = { start: bestCandidate.start, end }
                const facultyKey = `${faculty}:${bestCandidate.day}`
                facultyIntervals.set(facultyKey, [...(facultyIntervals.get(facultyKey) ?? []), interval])
                const roomKey = `${bestCandidate.room}:${bestCandidate.day}`
                roomIntervals.set(roomKey, [...(roomIntervals.get(roomKey) ?? []), interval])

                const subjectKey = `${faculty}:${first.subject}`
                const subjectDays = facultySubjectDays.get(subjectKey) ?? new Set<string>()
                subjectDays.add(bestCandidate.day)
                facultySubjectDays.set(subjectKey, subjectDays)

                assignments.push({
                    id,
                    day: bestCandidate.day,
                    startTime: formatMinutesToTime(bestCandidate.start),
                    room: bestCandidate.room,
                })
            }
        }

        return assignments
    }

    const prompt = {
        task: 'Assign a day, start time, and room to every queued weekly class following Philippine college/CHED academic scheduling standards. Return JSON only.',
        constraints: [
            `Schedule only on these days: ${schedulePolicy.teachingDays.join(', ')}.`,
            `Every class must start no earlier than ${schedulePolicy.dayStartTime} and end no later than ${schedulePolicy.dayEndTime}.`,
            'Use 24-hour HH:mm start times aligned to standard Philippine academic bells: 90-minute / TTh classes on 07:30, 09:00, 10:30, 13:00, 14:30, 16:00, 17:30; 60-minute / MWF classes on the hour (07:00, 08:00, 09:00, 10:00, 11:00, 13:00, 14:00, ...).',
            'Protect the Philippine noon lunch break (12:00–13:00): do NOT schedule classes overlapping 12:00–13:00 unless no non-lunch slot is available.',
            'Do not schedule any faculty member for more than 3 consecutive hours (180 minutes) without at least a 15–30 minute break.',
            'If a class specifies preferredDay, it MUST be assigned to that exact day.',
            'Classes sharing the same patternGroupId (such as MWF, TTh, or MW meetings of the same course) MUST be assigned the EXACT SAME startTime and the EXACT SAME room across their respective preferredDays.',
            'Prefer Monday–Friday for regular weekday/short classes and keep Saturday for 3-hour blocks/labs or overflow.',
            'A faculty member cannot teach two classes at the same time, and a room cannot host two classes at the same time.',
            'Do not overlap any existing class for the same faculty member or the same room.',
            'Every class must use a compatible room: a room with type "both" can host either lecture or lab classes; otherwise room type must match classType.',
            'If a class has preferredRoom, it must be assigned to that room. If preferredRoom is null or absent, select any compatible unoccupied room (preferring dedicated lecture/lab rooms over "both" rooms when available).',
            'Spread each faculty member’s classes evenly across the week.',
            'Schedule every queued class exactly once; do not omit or add class IDs.',
            'Each assignment room value must be one of the supplied room IDs.',
            'Return exactly {"assignments":[{"id":"class-1","day":"Monday","startTime":"08:00","room":"room-1"}]}.',
        ],
        rooms: roomRecords.map((room) => ({
            id: roomLabels.get(room.name),
            name: room.name,
            type: normalizeRoomUsageType(room.type),
        })),
        classes: pendingClasses.map((record) => ({
            id: classLabels.get(record._id.toString()),
            faculty: facultyLabels.get(record.facultyId.toString()),
            subject: record.subject,
            classType: record.classType ?? 'lecture',
            meetingPattern: record.meetingPattern ?? 'single',
            patternGroupId: record.patternGroupId ?? null,
            preferredDay: record.preferredDay ?? null,
            preferredRoom: record.preferredRoom ? roomLabels.get(record.preferredRoom) : null,
            durationMinutes: record.durationMinutes,
        })),
        existingClasses: existing.map((record) => ({
            faculty: record.faculty,
            room: record.room,
            classType: record.classType,
            roomType: record.roomType,
            day: record.day,
            startTime: record.startTime,
            endTime: record.endTime,
        })),
    }

    let response: Response | undefined
    if (apiKey) {
        try {
            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey,
                    },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: JSON.stringify(prompt) }] }],
                        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
                    }),
                    signal: AbortSignal.timeout(30_000),
                },
            )
        } catch {
            response = undefined
        }
    }

    if (response && !response.ok) {
        response = undefined
    }

    let usedAutomaticMode = false
    let generatedResult: unknown
    if (response) {
        try {
            const providerResult = await response.json()
            const text = z.object({
                candidates: z.array(z.object({
                    content: z.object({
                        parts: z.array(z.object({ text: z.string() })),
                    }),
                })).min(1),
            }).safeParse(providerResult)
            if (text.success) {
                generatedResult = JSON.parse(text.data.candidates[0].content.parts.map((part) => part.text).join(''))
            }
        } catch {
            generatedResult = undefined
        }
    }

    const pendingByLabel = new Map(pendingClasses.map((record) => [
        classLabels.get(record._id.toString())!,
        record,
    ]))
    const expectedLabels = pendingClasses.map((record) => classLabels.get(record._id.toString())!)

    function validateCandidateSchedule(candidate: unknown): ScheduleAssignment[] | null {
        const parsedSchedule = generatedScheduleSchema.safeParse(candidate)
        if (
            !parsedSchedule.success
            || parsedSchedule.data.assignments.length !== expectedLabels.length
            || new Set(parsedSchedule.data.assignments.map((assignment) => assignment.id)).size !== expectedLabels.length
            || parsedSchedule.data.assignments.some((assignment) => (
                !expectedLabels.includes(assignment.id)
                || !schedulePolicy.teachingDays.includes(assignment.day)
            ))
        ) {
            return null
        }

        const facultyIntervals = new Map<string, Array<{ start: number; end: number }>>()
        const roomIntervals = new Map<string, Array<{ start: number; end: number }>>()
        for (const assignment of existing) {
            const interval = { start: assignment.start, end: assignment.end }
            const facultyKey = `${assignment.faculty}:${assignment.day}`
            facultyIntervals.set(facultyKey, [...(facultyIntervals.get(facultyKey) ?? []), interval])
            const roomKey = `${assignment.room}:${assignment.day}`
            roomIntervals.set(roomKey, [...(roomIntervals.get(roomKey) ?? []), interval])
        }

        const groupSync = new Map<string, { startTime: string; room: string }>()
        const validated: ScheduleAssignment[] = []

        for (const assignment of parsedSchedule.data.assignments) {
            const record = pendingByLabel.get(assignment.id)
            if (!record) return null

            if (record.preferredDay && assignment.day !== record.preferredDay) {
                return null
            }

            const facultyId = record.facultyId.toString()
            const facultyLabel = facultyLabels.get(facultyId)
            const selectedRoom = roomsByLabel.get(assignment.room)
            if (!selectedRoom) return null

            const classType = roomTypes.includes(record.classType as RoomType) ? record.classType as RoomType : 'lecture'
            if (!isRoomCompatibleWithClassType(selectedRoom.type, classType)) {
                return null
            }
            if (record.preferredRoom && selectedRoom.name !== record.preferredRoom) {
                return null
            }

            if (record.patternGroupId) {
                const existingSync = groupSync.get(record.patternGroupId)
                if (existingSync) {
                    if (
                        existingSync.startTime !== assignment.startTime
                        || existingSync.room !== assignment.room
                    ) {
                        return null
                    }
                } else {
                    groupSync.set(record.patternGroupId, {
                        startTime: assignment.startTime,
                        room: assignment.room,
                    })
                }
            }

            const start = getMinutes(assignment.startTime)
            const end = start + record.durationMinutes
            const facultyDayIntervals = facultyIntervals.get(`${facultyLabel}:${assignment.day}`) ?? []
            const roomDayIntervals = roomIntervals.get(`${assignment.room}:${assignment.day}`) ?? []
            if (
                start < scheduleStart
                || end > scheduleEnd
                || end <= start
                || facultyDayIntervals.some((interval) => start < interval.end && end > interval.start)
                || roomDayIntervals.some((interval) => start < interval.end && end > interval.start)
            ) {
                return null
            }

            const interval = { start, end }
            facultyDayIntervals.push(interval)
            facultyIntervals.set(`${facultyLabel}:${assignment.day}`, facultyDayIntervals)
            roomDayIntervals.push(interval)
            roomIntervals.set(`${assignment.room}:${assignment.day}`, roomDayIntervals)

            const endTime = formatMinutesToTime(end)
            const member = facultyById.get(facultyId)
            if (!member) return null

            validated.push({
                id: record._id.toString(),
                facultyId,
                facultyName: member.name,
                facultyEmail: member.email,
                subject: record.subject,
                category: record.category,
                classType,
                meetingPattern: record.meetingPattern ?? 'single',
                room: selectedRoom.name,
                durationMinutes: record.durationMinutes,
                day: assignment.day,
                startTime: assignment.startTime,
                endTime,
            })
        }

        return validated
    }

    let generated = generatedResult ? validateCandidateSchedule(generatedResult) : null
    if (!generated) {
        const fallbackAssignments = createFallbackAssignments()
        if (!fallbackAssignments) {
            return NextResponse.json({
                message: 'No conflict-free Philippine academic schedule could be generated with the current rooms and teaching hours. Try adjusting durations, disabling lunch overlap conflicts, or adding more rooms.',
            }, { status: 409 })
        }
        generated = validateCandidateSchedule({ assignments: fallbackAssignments })
        if (!generated) {
            return NextResponse.json({
                message: 'Unable to validate generated schedule assignments. Please try again.',
            }, { status: 409 })
        }
        usedAutomaticMode = true
    }

    const session = await mongoose.startSession()
    try {
        await session.withTransaction(async () => {
            const result = await schedules.bulkWrite(
                generated.map((assignment) => ({
                    updateOne: {
                        filter: { _id: assignment.id, status: 'pending' },
                        update: {
                            $set: {
                                status: 'scheduled',
                                category: assignment.category,
                                classType: assignment.classType,
                                room: assignment.room,
                                day: assignment.day,
                                startTime: assignment.startTime,
                                endTime: assignment.endTime,
                                durationMinutes: assignment.durationMinutes,
                            },
                        },
                    },
                })),
                { session, ordered: true },
            )
            if (result.matchedCount !== generated.length) {
                throw new Error('The class queue changed while the schedule was being generated.')
            }
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'The class queue changed while the schedule was being generated.') {
            return NextResponse.json({
                message: `${error.message} Refresh and try again.`,
            }, { status: 409 })
        }
        console.error('Failed to save the generated schedule to MongoDB:', error)
        return NextResponse.json({
            message: 'The generated schedule could not be saved to MongoDB. No schedule changes were committed; please try again.',
        }, { status: 500 })
    } finally {
        await session.endSession()
    }

    let savedRecords
    try {
        savedRecords = await schedules.find({
            _id: { $in: generated.map((assignment) => assignment.id) },
            status: 'scheduled',
        }).select('_id category classType room day startTime endTime durationMinutes').lean()
    } catch (error) {
        console.error('Failed to verify the generated schedule in MongoDB:', error)
        return NextResponse.json({
            message: 'The schedule was saved, but its MongoDB record could not be verified. Refresh the schedule before trying again.',
        }, { status: 500 })
    }
    const savedById = new Map(savedRecords.map((record) => [record._id.toString(), record]))
    const allAssignmentsSaved = generated.every((assignment) => {
        const saved = savedById.get(assignment.id)
        return saved
            && saved.category === assignment.category
            && saved.classType === assignment.classType
            && saved.room === assignment.room
            && saved.day === assignment.day
            && saved.startTime === assignment.startTime
            && saved.endTime === assignment.endTime
            && saved.durationMinutes === assignment.durationMinutes
    })
    if (!allAssignmentsSaved) {
        return NextResponse.json({
            message: 'The schedule could not be verified after saving. Refresh the schedule and try again.',
        }, { status: 500 })
    }

    return NextResponse.json({
        data: generated,
        mode: usedAutomaticMode ? 'automatic' : 'ai',
    })
}
