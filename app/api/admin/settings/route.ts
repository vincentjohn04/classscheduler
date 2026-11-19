import { NextResponse } from 'next/server'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { scheduleDays } from '@/lib/schedule'
import { platformSettings } from '@/model/platform-settings'
import { schedules } from '@/model/schedule'

const defaults = {
    academicTerm: 'First Semester',
    academicYear: 2026,
    teachingDays: [...scheduleDays],
    dayStartTime: '07:00',
    dayEndTime: '20:00',
} as const
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const settingsSchema = z.object({
    academicTerm: z.enum(['First Semester', 'Second Semester', 'Summer']),
    academicYear: z.number().int().min(2000).max(2100),
    teachingDays: z.array(z.enum(scheduleDays)).min(1)
        .refine((days) => new Set(days).size === days.length, 'Teaching days must be unique.'),
    dayStartTime: z.string().regex(timePattern),
    dayEndTime: z.string().regex(timePattern),
}).refine((settings) => settings.dayStartTime < settings.dayEndTime, {
    message: 'The teaching day end time must be later than its start time.',
})

export async function GET() {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    await connectDb()
    const settings = await platformSettings.findOne({ key: 'global' })
        .select('academicTerm academicYear teachingDays dayStartTime dayEndTime')
        .lean()

    return NextResponse.json({
        data: {
            academicTerm: settings?.academicTerm ?? defaults.academicTerm,
            academicYear: settings?.academicYear ?? defaults.academicYear,
            teachingDays: settings?.teachingDays ?? defaults.teachingDays,
            dayStartTime: settings?.dayStartTime ?? defaults.dayStartTime,
            dayEndTime: settings?.dayEndTime ?? defaults.dayEndTime,
        },
    })
}

export async function PATCH(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ message: 'Enter valid workspace settings.' }, { status: 400 })
    }

    const parsed = settingsSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Enter valid workspace settings.' }, { status: 400 })
    }

    await connectDb()
    const invalidatedSchedule = await schedules.exists({
        $and: [
            { $or: [{ status: 'scheduled' }, { status: { $exists: false } }] },
            {
                $or: [
                    { day: { $nin: parsed.data.teachingDays } },
                    { startTime: { $lt: parsed.data.dayStartTime } },
                    { endTime: { $gt: parsed.data.dayEndTime } },
                ],
            },
        ],
    })
    if (invalidatedSchedule) {
        return NextResponse.json({
            message: 'The new teaching days or hours would exclude an existing scheduled class. Reassign or remove those classes before saving.',
        }, { status: 409 })
    }

    const settings = await platformSettings.findOneAndUpdate(
        { key: 'global' },
        { $set: parsed.data, $setOnInsert: { key: 'global' } },
        { new: true, upsert: true, runValidators: true },
    ).select('academicTerm academicYear teachingDays dayStartTime dayEndTime').lean()

    if (!settings) {
        return NextResponse.json({ message: 'The workspace settings could not be saved.' }, { status: 500 })
    }

    return NextResponse.json({
        data: {
            academicTerm: settings.academicTerm,
            academicYear: settings.academicYear,
            teachingDays: settings.teachingDays,
            dayStartTime: settings.dayStartTime,
            dayEndTime: settings.dayEndTime,
        },
        message: 'Workspace settings saved.',
    })
}
