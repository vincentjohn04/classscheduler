import { NextResponse } from 'next/server'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { scheduleDays } from '@/lib/schedule'
import { getSchedulePolicy } from '@/lib/schedule-policy'
import { roomTypes } from '@/lib/rooms'
import { rooms } from '@/model/room'
import { schedules } from '@/model/schedule'

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const availabilityQuerySchema = z.object({
    day: z.enum(scheduleDays),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
    classType: z.enum(roomTypes).default('lecture'),
})

export async function GET(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'user') {
        return NextResponse.json({ message: 'Only faculty members can check request availability.' }, { status: 403 })
    }

    const parsed = availabilityQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams),
    )
    if (!parsed.success || parsed.data.startTime >= parsed.data.endTime) {
        return NextResponse.json({ message: 'Choose a valid day and time range.' }, { status: 400 })
    }

    const { day, startTime, endTime, classType } = parsed.data
    await connectDb()
    const policy = await getSchedulePolicy()
    if (!policy.teachingDays.includes(day)) {
        return NextResponse.json({ message: `${day} is not currently enabled for teaching.` }, { status: 400 })
    }
    if (startTime < policy.dayStartTime || endTime > policy.dayEndTime) {
        return NextResponse.json({
            message: `Choose a time between ${policy.dayStartTime} and ${policy.dayEndTime}.`,
        }, { status: 400 })
    }

    const availableRoomRecords = await rooms.find(classType === 'lecture'
        ? { $or: [{ type: 'lecture' }, { type: { $exists: false } }] }
        : { type: 'lab' },
    ).select('name').sort({ name: 1 }).lean()
    const roomNames = availableRoomRecords.map((room) => room.name)
    const occupiedSchedules = roomNames.length
        ? await schedules.find({
            room: { $in: roomNames },
            day,
            $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
            startTime: { $lt: endTime },
            endTime: { $gt: startTime },
        }).select('room startTime endTime').lean()
        : []
    const schedulesByRoom = new Map<string, Array<{ startTime: string; endTime: string }>>()
    for (const schedule of occupiedSchedules) {
        if (!schedule.room || !schedule.startTime || !schedule.endTime) continue
        const roomSchedules = schedulesByRoom.get(schedule.room) ?? []
        roomSchedules.push({ startTime: schedule.startTime, endTime: schedule.endTime })
        schedulesByRoom.set(schedule.room, roomSchedules)
    }

    return NextResponse.json({
        data: availableRoomRecords.map((room) => {
            const conflicts = schedulesByRoom.get(room.name) ?? []
            return {
                name: room.name,
                status: conflicts.length ? 'occupied' : 'available',
                conflicts,
            }
        }),
    })
}
