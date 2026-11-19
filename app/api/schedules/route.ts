import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { roomTypes } from '@/lib/rooms'
import { scheduleDays } from '@/lib/schedule'
import { getSchedulePolicy } from '@/lib/schedule-policy'
import { rooms } from '@/model/room'
import { schedules } from '@/model/schedule'
import { users } from '@/model/user'
import { curriculumSubjects } from '@/model/curriculum-subject'

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const classInputSchema = z.object({
    facultyId: z.string().refine(mongoose.isValidObjectId, 'Invalid faculty id'),
    subject: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(100),
    classType: z.enum(roomTypes).default('lecture'),
    preferredRoom: z.string().trim().min(1).max(60).optional(),
    durationMinutes: z.number().int().min(15).max(780),
})
const scheduleUpdateSchema = z.object({
    id: z.string().refine(mongoose.isValidObjectId, 'Invalid schedule id'),
    facultyId: z.string().refine(mongoose.isValidObjectId, 'Invalid faculty id'),
    subject: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(100),
    classType: z.enum(roomTypes).default('lecture'),
    day: z.enum(scheduleDays),
    room: z.string().trim().min(1).max(60),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
})
const scheduleIdSchema = z.string().refine(mongoose.isValidObjectId, 'Invalid schedule id')

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

export async function GET() {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    await connectDb()
    const filter = currentUser.role === 'admin'
        ? {}
        : { facultyId: currentUser.id, $or: [{ status: 'scheduled' }, { status: { $exists: false } }] }
    const records = await schedules.find(filter).sort({ createdAt: 1, startTime: 1 }).lean()
    const roomNames = [...new Set(records.map((record) => record.room).filter((room): room is string => !!room))]
    const roomRecords = await rooms.find({ name: { $in: roomNames } }).select('name type').lean()
    const roomTypesByName = new Map(roomRecords.map((room) => [room.name, room.type ?? 'lecture']))
    const facultyIds = [...new Set(records.map((record) => record.facultyId.toString()))]
    const faculty = await users.find({ _id: { $in: facultyIds } }).select('name email').lean()
    const facultyById = new Map(faculty.map((member) => [member._id.toString(), member]))
    const data = records.flatMap((record) => {
        const member = facultyById.get(record.facultyId.toString())
        if (!member) return []

        return [{
            id: record._id.toString(),
            facultyId: record.facultyId.toString(),
            facultyName: member.name,
            facultyEmail: member.email,
            subject: record.subject,
            category: record.category ?? '',
            classType: record.classType ?? roomTypesByName.get(record.room ?? '') ?? 'lecture',
            preferredRoom: record.preferredRoom ?? undefined,
            room: record.room ?? '',
            durationMinutes: record.durationMinutes,
            status: record.status,
            day: record.day,
            startTime: record.startTime,
            endTime: record.endTime,
        }]
    })

    return NextResponse.json({
        data: {
            schedules: data.filter((record) => (
                record.status === 'scheduled'
                || (!record.status && record.day && record.startTime && record.endTime)
            )),
            pending: currentUser.role === 'admin'
                ? data.filter((record) => record.status === 'pending')
                : [],
        },
    })
}

export async function POST(request: NextRequest) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const parsed = classInputSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ message: 'Enter a faculty member, subject, and class duration from 15 to 780 minutes.' }, { status: 400 })
    }

    await connectDb()
    const curriculumEntry = await curriculumSubjects.exists({
        name: parsed.data.subject,
        category: parsed.data.category,
    })
    if (!curriculumEntry) {
        return NextResponse.json({ message: 'Choose a subject and class category from the recorded curriculum.' }, { status: 400 })
    }

    const member = await users.findOne({ _id: parsed.data.facultyId, role: 'user' }).select('name email').lean()
    if (!member) return NextResponse.json({ message: 'Faculty member not found.' }, { status: 404 })

    if (parsed.data.preferredRoom) {
        const room = await rooms.findOne({ name: parsed.data.preferredRoom }).select('type').lean()
        if (!room) {
            return NextResponse.json({ message: 'Choose a room from the room inventory, or leave the room on automatic selection.' }, { status: 400 })
        }
        if ((room.type ?? 'lecture') !== parsed.data.classType) {
            return NextResponse.json({ message: `Choose a ${parsed.data.classType === 'lab' ? 'Lab' : 'Lecture'} room for this class, or leave automatic selection.` }, { status: 409 })
        }
    }

    const created = await schedules.create({
        ...parsed.data,
        status: 'pending',
    })
    return NextResponse.json({
        data: {
            id: created._id.toString(),
            facultyId: parsed.data.facultyId,
            facultyName: member.name,
            facultyEmail: member.email,
            subject: created.subject,
            category: created.category,
            classType: created.classType,
            preferredRoom: created.preferredRoom ?? undefined,
            durationMinutes: created.durationMinutes,
        },
    }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const parsed = scheduleUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ message: 'Enter a valid faculty member, subject, day, and class time.' }, { status: 400 })
    }

    const { id, facultyId, subject, category, classType, day, room, startTime, endTime } = parsed.data
    await connectDb()
    const schedulePolicy = await getSchedulePolicy()
    if (!isWithinScheduleHours(startTime, endTime, day, schedulePolicy)) {
        return NextResponse.json({
            message: `Choose an enabled teaching day and a class time between ${schedulePolicy.dayStartTime} and ${schedulePolicy.dayEndTime}.`,
        }, { status: 400 })
    }

    const curriculumEntry = await curriculumSubjects.exists({ name: subject, category })
    if (!curriculumEntry) {
        return NextResponse.json({ message: 'Choose a subject and class category from the recorded curriculum.' }, { status: 400 })
    }

    const member = await users.findOne({ _id: facultyId, role: 'user' }).select('name email').lean()
    if (!member) return NextResponse.json({ message: 'Faculty member not found.' }, { status: 404 })
    const roomRecord = await rooms.findOne({ name: room }).select('type').lean()
    if (!roomRecord) {
        return NextResponse.json({ message: 'Select a room from the room inventory.' }, { status: 400 })
    }
    if ((roomRecord.type ?? 'lecture') !== classType) {
        return NextResponse.json({
            message: `Choose a ${classType === 'lab' ? 'Lab' : 'Lecture'} room for this class.`,
        }, { status: 409 })
    }

    const facultyConflict = await schedules.findOne({
        _id: { $ne: id },
        facultyId,
        day,
        $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
    }).select('subject startTime endTime').lean()
    if (facultyConflict) {
        return NextResponse.json({
            message: `This faculty member already has ${facultyConflict.subject} scheduled from ${facultyConflict.startTime} to ${facultyConflict.endTime} on ${day}.`,
        }, { status: 409 })
    }
    const roomConflict = await schedules.findOne({
        _id: { $ne: id },
        room,
        day,
        $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
    }).select('subject startTime endTime').lean()
    if (roomConflict) {
        return NextResponse.json({
            message: `${room} is already assigned to ${roomConflict.subject} from ${roomConflict.startTime} to ${roomConflict.endTime} on ${day}.`,
        }, { status: 409 })
    }

    const updated = await schedules.findOneAndUpdate(
        { _id: id, $or: [{ status: 'scheduled' }, { status: { $exists: false } }] },
        {
            facultyId,
            subject,
            category,
            classType,
            room,
            status: 'scheduled',
            day,
            startTime,
            endTime,
            durationMinutes: getDurationMinutes(startTime, endTime),
        },
        { new: true, runValidators: true },
    ).lean()
    if (!updated) return NextResponse.json({ message: 'Scheduled class not found.' }, { status: 404 })

    return NextResponse.json({
        data: {
            id: updated._id.toString(),
            facultyId,
            facultyName: member.name,
            facultyEmail: member.email,
            subject: updated.subject,
            category: updated.category,
            classType: updated.classType,
            room: updated.room,
            durationMinutes: updated.durationMinutes,
            day: updated.day,
            startTime: updated.startTime,
            endTime: updated.endTime,
        },
    })
}

export async function DELETE(request: NextRequest) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id || !scheduleIdSchema.safeParse(id).success) {
        return NextResponse.json({ message: 'Invalid schedule id.' }, { status: 400 })
    }

    await connectDb()
    const deleted = await schedules.findByIdAndDelete(id)
    if (!deleted) return NextResponse.json({ message: 'Class not found.' }, { status: 404 })
    return NextResponse.json({ message: 'Class removed.' })
}
