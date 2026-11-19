import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { roomTypes, type RoomType } from '@/lib/rooms'
import { scheduleDays, type ScheduleAssignment } from '@/lib/schedule'
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

function getMinutes(time: string) {
    const [hour, minute] = time.split(':').map(Number)
    return hour * 60 + minute
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
    const availableRoomTypes = new Set(roomRecords.map((room) => room.type ?? 'lecture'))
    const classWithoutRoom = pendingClasses.find((record) => !availableRoomTypes.has(record.classType ?? 'lecture'))
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
        { name: room.name, type: room.type ?? 'lecture' },
    ]))
    const invalidRoomPreference = pendingClasses.find((record) => {
        if (!record.preferredRoom) return false
        const room = roomsByName.get(record.preferredRoom)
        return !room || (room.type ?? 'lecture') !== (record.classType ?? 'lecture')
    })
    if (invalidRoomPreference) {
        return NextResponse.json({
            message: `The selected room for ${invalidRoomPreference.subject} is no longer available or compatible. Edit the class and choose another room or automatic selection.`,
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

        return {
            faculty: facultyLabels.get(record.facultyId.toString()),
            room: record.room ? roomLabels.get(record.room) : undefined,
            classType: record.classType ?? (record.room ? roomsByName.get(record.room)?.type : undefined) ?? 'lecture',
            roomType: record.room ? roomsByName.get(record.room)?.type : undefined,
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
        || record.roomType !== record.classType
        || typeof record.day !== 'string'
        || !schedulePolicy.teachingDays.includes(record.day as (typeof scheduleDays)[number])
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
        for (const assignment of existing) {
            const interval = { start: assignment.start, end: assignment.end }
            const facultyKey = `${assignment.faculty}:${assignment.day}`
            facultyIntervals.set(facultyKey, [...(facultyIntervals.get(facultyKey) ?? []), interval])
            const roomKey = `${assignment.room}:${assignment.day}`
            roomIntervals.set(roomKey, [...(roomIntervals.get(roomKey) ?? []), interval])
        }

        const assignments: Array<{ id: string; day: (typeof scheduleDays)[number]; startTime: string; room: string }> = []
        for (const record of pendingClasses) {
            const id = classLabels.get(record._id.toString())
            const faculty = facultyLabels.get(record.facultyId.toString())
            const classType = record.classType ?? 'lecture'
            if (!id || !faculty) return null

            let selected: { day: (typeof scheduleDays)[number]; start: number; room: string } | undefined
            for (const day of schedulePolicy.teachingDays) {
                for (let start = scheduleStart; start + record.durationMinutes <= scheduleEnd; start += 15) {
                    for (const [roomLabel, room] of roomsByLabel) {
                        if (room.type !== classType) continue
                        if (record.preferredRoom && room.name !== record.preferredRoom) continue
                        const end = start + record.durationMinutes
                        const facultyDay = facultyIntervals.get(`${faculty}:${day}`) ?? []
                        const roomDay = roomIntervals.get(`${roomLabel}:${day}`) ?? []
                        if (
                            facultyDay.some((interval) => start < interval.end && end > interval.start)
                            || roomDay.some((interval) => start < interval.end && end > interval.start)
                        ) continue

                        if (
                            !selected
                            || facultyDay.length < (facultyIntervals.get(`${faculty}:${selected.day}`) ?? []).length
                            || (
                                facultyDay.length === (facultyIntervals.get(`${faculty}:${selected.day}`) ?? []).length
                                && (day.localeCompare(selected.day) < 0 || (day === selected.day && start < selected.start))
                            )
                        ) {
                            selected = { day, start, room: roomLabel }
                        }
                    }
                }
            }

            if (!selected) return null
            const end = selected.start + record.durationMinutes
            const interval = { start: selected.start, end }
            const facultyKey = `${faculty}:${selected.day}`
            facultyIntervals.set(facultyKey, [...(facultyIntervals.get(facultyKey) ?? []), interval])
            const roomKey = `${selected.room}:${selected.day}`
            roomIntervals.set(roomKey, [...(roomIntervals.get(roomKey) ?? []), interval])
            assignments.push({
                id,
                day: selected.day,
                startTime: `${String(Math.floor(selected.start / 60)).padStart(2, '0')}:${String(selected.start % 60).padStart(2, '0')}`,
                room: selected.room,
            })
        }
        return assignments
    }

    const prompt = {
        task: 'Assign a day, start time, and room to every queued weekly class. Return JSON only.',
        constraints: [
            `Schedule only on these days: ${schedulePolicy.teachingDays.join(', ')}.`,
            `Every class must start no earlier than ${schedulePolicy.dayStartTime} and end no later than ${schedulePolicy.dayEndTime}.`,
            'Use 24-hour HH:mm start times.',
            'A faculty member cannot teach two classes at the same time. Classes for the same faculty may be consecutive.',
            'A room cannot be assigned to two classes at overlapping times on the same day.',
            'Do not overlap any existing class for the same faculty member.',
            'Do not overlap any existing class using the same room.',
            'Every class must use a room whose type matches the classType exactly.',
            'If a class has preferredRoom, it must be assigned to that room. If preferredRoom is null or absent, select any compatible unoccupied room.',
            'Schedule every queued class exactly once; do not omit or add class IDs.',
            'Spread each faculty member’s classes across the week when possible.',
            'Each assignment room value must be one of the supplied room IDs.',
            'Return exactly {"assignments":[{"id":"class-1","day":"Monday","startTime":"08:00","room":"room-1"}]}.',
        ],
        rooms: roomRecords.map((room) => ({
            id: roomLabels.get(room.name),
            name: room.name,
            type: room.type ?? 'lecture',
        })),
        classes: pendingClasses.map((record) => ({
            id: classLabels.get(record._id.toString()),
            faculty: facultyLabels.get(record.facultyId.toString()),
            subject: record.subject,
            classType: record.classType ?? 'lecture',
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

    let generatedResult: unknown
    if (response) {
        let providerResult: unknown
        try {
            providerResult = await response.json()
        } catch {
            return NextResponse.json({ message: 'The AI schedule service returned an unreadable response. Please try again.' }, { status: 502 })
        }

        const text = z.object({
            candidates: z.array(z.object({
                content: z.object({
                    parts: z.array(z.object({ text: z.string() })),
                }),
            })).min(1),
        }).safeParse(providerResult)
        if (!text.success) {
            return NextResponse.json({ message: 'The AI schedule service did not return a schedule. Please try again.' }, { status: 502 })
        }

        try {
            generatedResult = JSON.parse(text.data.candidates[0].content.parts.map((part) => part.text).join(''))
        } catch {
            return NextResponse.json({ message: 'The AI schedule service returned invalid schedule data. Please try again.' }, { status: 502 })
        }
    } else {
        const fallbackAssignments = createFallbackAssignments()
        if (!fallbackAssignments) {
            return NextResponse.json({
                message: 'The AI service is unavailable, and no conflict-free schedule could be created automatically. Try shorter classes or add more rooms.',
            }, { status: 409 })
        }
        generatedResult = { assignments: fallbackAssignments }
    }

    const parsedSchedule = generatedScheduleSchema.safeParse(generatedResult)
    const expectedLabels = pendingClasses.map((record) => classLabels.get(record._id.toString())!)
    if (
        !parsedSchedule.success
        || parsedSchedule.data.assignments.length !== expectedLabels.length
        || new Set(parsedSchedule.data.assignments.map((assignment) => assignment.id)).size !== expectedLabels.length
        || parsedSchedule.data.assignments.some((assignment) => (
            !expectedLabels.includes(assignment.id)
            || !schedulePolicy.teachingDays.includes(assignment.day)
        ))
    ) {
        return NextResponse.json({
            message: 'The AI returned an incomplete or invalid schedule. No classes were changed; please generate again.',
        }, { status: 502 })
    }

    const pendingByLabel = new Map(pendingClasses.map((record) => [
        classLabels.get(record._id.toString())!,
        record,
    ]))
    const facultyIntervals = new Map<string, Array<{ start: number; end: number }>>()
    const roomIntervals = new Map<string, Array<{ start: number; end: number }>>()
    for (const assignment of existing) {
        const interval = { start: assignment.start, end: assignment.end }
        const facultyKey = `${assignment.faculty}:${assignment.day}`
        const facultyDayIntervals = facultyIntervals.get(facultyKey) ?? []
        facultyDayIntervals.push(interval)
        facultyIntervals.set(facultyKey, facultyDayIntervals)

        const roomKey = `${assignment.room}:${assignment.day}`
        const roomDayIntervals = roomIntervals.get(roomKey) ?? []
        roomDayIntervals.push(interval)
        roomIntervals.set(roomKey, roomDayIntervals)
    }

    const generated: ScheduleAssignment[] = []
    for (const assignment of parsedSchedule.data.assignments) {
        const record = pendingByLabel.get(assignment.id)
        if (!record) {
            return NextResponse.json({ message: 'The AI returned an unknown class. No classes were changed.' }, { status: 502 })
        }

        const facultyId = record.facultyId.toString()
        const facultyLabel = facultyLabels.get(facultyId)
        const selectedRoom = roomsByLabel.get(assignment.room)
        if (!selectedRoom) {
            return NextResponse.json({ message: 'The AI selected an unknown room. No classes were changed; please generate again.' }, { status: 502 })
        }
        const classType = roomTypes.includes(record.classType as RoomType) ? record.classType as RoomType : 'lecture'
        if (selectedRoom.type !== classType) {
            return NextResponse.json({
                message: `The AI selected a room that is not compatible with this ${classType === 'lab' ? 'Lab' : 'Lecture'} class. No classes were changed; please generate again.`,
            }, { status: 409 })
        }
        if (record.preferredRoom && selectedRoom.name !== record.preferredRoom) {
            return NextResponse.json({
                message: `The selected room preference for ${record.subject} was not followed. No classes were changed; please generate again.`,
            }, { status: 409 })
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
            return NextResponse.json({
                message: 'The AI proposed a faculty or room conflict, or an out-of-hours class. No classes were changed; please generate again.',
            }, { status: 409 })
        }

        const interval = { start, end }
        facultyDayIntervals.push(interval)
        facultyIntervals.set(`${facultyLabel}:${assignment.day}`, facultyDayIntervals)
        roomDayIntervals.push(interval)
        roomIntervals.set(`${assignment.room}:${assignment.day}`, roomDayIntervals)
        const endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
        const member = facultyById.get(facultyId)
        if (!member) {
            return NextResponse.json({ message: 'A faculty member could not be found. No classes were changed.' }, { status: 409 })
        }

        generated.push({
            id: record._id.toString(),
            facultyId,
            facultyName: member.name,
            facultyEmail: member.email,
            subject: record.subject,
            category: record.category,
            classType,
            room: selectedRoom.name,
            durationMinutes: record.durationMinutes,
            day: assignment.day,
            startTime: assignment.startTime,
            endTime,
        })
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
    if (!allAssignmentsSaved || savedRecords.length !== generated.length) {
        console.error('Generated schedule persistence verification failed in MongoDB.')
        return NextResponse.json({
            message: 'The generated schedule was not fully verified in MongoDB. Refresh the schedule before trying again.',
        }, { status: 500 })
    }

    return NextResponse.json({
        data: generated,
        mode: response ? 'ai' : 'automatic',
        persisted: true,
    }, { status: 201 })
}
