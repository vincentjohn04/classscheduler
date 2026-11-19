import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { scheduleDays } from '@/lib/schedule'
import { getSchedulePolicy } from '@/lib/schedule-policy'
import { getCompatibleRoomFilter, roomTypes, type RoomType } from '@/lib/rooms'
import { rooms } from '@/model/room'
import { scheduleRequests } from '@/model/schedule-request'
import { schedules } from '@/model/schedule'
import { users } from '@/model/user'
import { curriculumSubjects } from '@/model/curriculum-subject'

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const createRequestSchema = z.object({
    subject: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(100),
    classType: z.enum(roomTypes).default('lecture'),
    day: z.enum(scheduleDays),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
})
const reviewRequestSchema = z.object({
    id: z.string().refine(mongoose.isValidObjectId, 'Invalid request id'),
    decision: z.enum(['approved', 'rejected']),
})

function isWithinScheduleHours(startTime: string, endTime: string, day: string, policy: Awaited<ReturnType<typeof getSchedulePolicy>>) {
    return policy.teachingDays.includes(day as (typeof scheduleDays)[number])
        && startTime >= policy.dayStartTime
        && endTime <= policy.dayEndTime
        && startTime < endTime
}

function getDurationMinutes(startTime: string, endTime: string) {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    return endHour * 60 + endMinute - startHour * 60 - startMinute
}

async function findConflicts(facultyId: string, day: string, startTime: string, endTime: string) {
    return schedules.find({
        facultyId,
        day,
        $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
    }).select('subject startTime endTime').lean()
}

function formatRequest(request: {
    _id: mongoose.Types.ObjectId
    facultyId: mongoose.Types.ObjectId
    subject: string
    category?: string
    classType?: RoomType
    day: string
    startTime: string
    endTime: string
    status: string
    createdAt?: Date
}, faculty?: { name: string; email: string }) {
    return {
        id: request._id.toString(),
        facultyId: request.facultyId.toString(),
        facultyName: faculty?.name,
        facultyEmail: faculty?.email,
        subject: request.subject,
        category: request.category,
        classType: request.classType ?? 'lecture',
        day: request.day,
        startTime: request.startTime,
        endTime: request.endTime,
        status: request.status,
        createdAt: request.createdAt ?? null,
    }
}

export async function GET() {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    await connectDb()
    const requestRecords = await scheduleRequests.find(
        currentUser.role === 'admin' ? {} : { facultyId: currentUser.id },
    ).sort({ createdAt: -1 }).lean()
    const facultyIds = [...new Set(requestRecords.map((record) => record.facultyId.toString()))]
    const facultyRecords = currentUser.role === 'admin'
        ? await users.find({ _id: { $in: facultyIds } }).select('name email').lean()
        : []
    const facultyById = new Map(facultyRecords.map((faculty) => [faculty._id.toString(), faculty]))

    return NextResponse.json({
        data: requestRecords.map((record) => formatRequest(
            record,
            currentUser.role === 'admin' ? facultyById.get(record.facultyId.toString()) : undefined,
        )),
    })
}

export async function POST(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'user') return NextResponse.json({ message: 'Only faculty members can request a schedule.' }, { status: 403 })

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ message: 'Enter valid schedule request details.' }, { status: 400 })
    }

    const parsed = createRequestSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ message: 'Choose a curriculum subject and class, valid day, and start and end times.' }, { status: 400 })
    }
    const { subject, category, classType, day, startTime, endTime } = parsed.data
    await connectDb()
    const curriculumEntry = await curriculumSubjects.findOne({ name: subject })
        .select('category department')
        .lean()
    if (!curriculumEntry || (curriculumEntry.category || curriculumEntry.department || 'Uncategorized') !== category) {
        return NextResponse.json({ message: 'Choose a subject and class from the current curriculum.' }, { status: 400 })
    }
    const schedulePolicy = await getSchedulePolicy()
    if (!isWithinScheduleHours(startTime, endTime, day, schedulePolicy)) {
        return NextResponse.json({
            message: `Choose an enabled teaching day and a request time between ${schedulePolicy.dayStartTime} and ${schedulePolicy.dayEndTime}.`,
        }, { status: 400 })
    }

    const conflicts = await findConflicts(currentUser.id, day, startTime, endTime)
    const created = await scheduleRequests.create({
        facultyId: currentUser.id,
        subject,
        category,
        classType,
        day,
        startTime,
        endTime,
        status: 'pending',
    })
    return NextResponse.json({
        data: formatRequest(created),
        conflicts: conflicts.map((conflict) => ({
            subject: conflict.subject,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
        })),
        message: conflicts.length
            ? 'Request sent, but it overlaps a class already on your schedule. The administrator will review the conflict.'
            : 'Schedule request sent to the administrator.',
    }, { status: 201 })
}

export async function PATCH(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ message: 'Enter a valid request decision.' }, { status: 400 })
    }
    const parsed = reviewRequestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ message: 'Select a valid schedule request and decision.' }, { status: 400 })

    await connectDb()
    const scheduleRequest = await scheduleRequests.findOne({
        _id: parsed.data.id,
        status: 'pending',
    }).lean()
    if (!scheduleRequest) return NextResponse.json({ message: 'Pending schedule request not found.' }, { status: 404 })

    if (parsed.data.decision === 'rejected') {
        await scheduleRequests.findByIdAndUpdate(scheduleRequest._id, { status: 'rejected' })
        return NextResponse.json({ message: 'Schedule request declined.' })
    }

    const schedulePolicy = await getSchedulePolicy()
    if (!isWithinScheduleHours(
        scheduleRequest.startTime,
        scheduleRequest.endTime,
        scheduleRequest.day,
        schedulePolicy,
    )) {
        return NextResponse.json({
            message: 'Cannot approve: this request is outside the current teaching days or hours.',
        }, { status: 409 })
    }

    const curriculumEntries = await curriculumSubjects.find({ name: scheduleRequest.subject })
        .select('category department')
        .lean()
    const matchingCurriculumEntry = scheduleRequest.category
        ? curriculumEntries.find((entry) => (
            (entry.category || entry.department || 'Uncategorized') === scheduleRequest.category
        ))
        : curriculumEntries.length === 1 ? curriculumEntries[0] : undefined
    if (!matchingCurriculumEntry) {
        return NextResponse.json({
            message: 'Cannot approve: choose a current curriculum subject and class, then submit a new request.',
        }, { status: 409 })
    }
    const category = matchingCurriculumEntry.category || matchingCurriculumEntry.department || 'Uncategorized'
    const classType: RoomType = scheduleRequest.classType ?? 'lecture'

    const conflicts = await findConflicts(
        scheduleRequest.facultyId.toString(),
        scheduleRequest.day,
        scheduleRequest.startTime,
        scheduleRequest.endTime,
    )
    if (conflicts.length) {
        const conflict = conflicts[0]
        return NextResponse.json({
            message: `Cannot approve: this faculty member already has ${conflict.subject} scheduled from ${conflict.startTime} to ${conflict.endTime}.`,
        }, { status: 409 })
    }

    const unassignedSchedule = await schedules.exists({
        $and: [
            { $or: [{ status: 'scheduled' }, { status: { $exists: false } }] },
            { $or: [{ room: { $exists: false } }, { room: '' }, { room: null }] },
        ],
    })
    if (unassignedSchedule) {
        return NextResponse.json({
            message: 'Assign rooms to existing scheduled classes before approving another request.',
        }, { status: 409 })
    }

    const availableRooms = await rooms
        .find(getCompatibleRoomFilter(classType))
        .select('name')
        .sort({ name: 1 })
        .lean()
    let selectedRoom: (typeof availableRooms)[number] | undefined
    for (const room of availableRooms) {
        const roomConflict = await schedules.exists({
            room: room.name,
            day: scheduleRequest.day,
            $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
            startTime: { $lt: scheduleRequest.endTime },
            endTime: { $gt: scheduleRequest.startTime },
        })
        if (!roomConflict) {
            selectedRoom = room
            break
        }
    }
    if (!selectedRoom) {
        return NextResponse.json({
            message: availableRooms.length
                ? `Cannot approve: all rooms are occupied on ${scheduleRequest.day} during the requested time.`
                : `Cannot approve: add a ${classType === 'lab' ? 'Lab' : 'Lecture'} room to the room inventory first.`,
        }, { status: 409 })
    }

    const createdSchedule = await schedules.create({
        facultyId: scheduleRequest.facultyId,
        subject: scheduleRequest.subject,
        category,
        classType,
        room: selectedRoom.name,
        durationMinutes: getDurationMinutes(scheduleRequest.startTime, scheduleRequest.endTime),
        day: scheduleRequest.day,
        startTime: scheduleRequest.startTime,
        endTime: scheduleRequest.endTime,
        status: 'scheduled',
    })
    const updatedRequest = await scheduleRequests.findOneAndUpdate(
        { _id: scheduleRequest._id, status: 'pending' },
        { status: 'approved', scheduleId: createdSchedule._id },
        { new: true },
    )
    if (!updatedRequest) {
        await schedules.findByIdAndDelete(createdSchedule._id)
        return NextResponse.json({ message: 'This request has already been reviewed.' }, { status: 409 })
    }

    const faculty = await users.findById(scheduleRequest.facultyId).select('name email').lean()
    if (!faculty) {
        await schedules.findByIdAndDelete(createdSchedule._id)
        await scheduleRequests.findByIdAndUpdate(scheduleRequest._id, { status: 'pending', $unset: { scheduleId: 1 } })
        return NextResponse.json({ message: 'Faculty member not found; request remains pending.' }, { status: 404 })
    }

    return NextResponse.json({
        message: 'Schedule request approved and added to the faculty schedule.',
        data: {
            id: createdSchedule._id.toString(),
            facultyId: scheduleRequest.facultyId.toString(),
            facultyName: faculty.name,
            facultyEmail: faculty.email,
            subject: createdSchedule.subject,
            category: createdSchedule.category,
            classType: createdSchedule.classType,
            room: createdSchedule.room,
            durationMinutes: createdSchedule.durationMinutes,
            day: createdSchedule.day,
            startTime: createdSchedule.startTime,
            endTime: createdSchedule.endTime,
        },
    })
}
