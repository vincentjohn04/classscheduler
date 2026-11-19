import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { formatRoomUsageType, normalizeRoomUsageType, roomUsageTypes } from '@/lib/rooms'
import { rooms } from '@/model/room'
import { schedules } from '@/model/schedule'

const roomSchema = z.object({
    name: z.string().trim().min(1).max(60),
    type: z.enum(roomUsageTypes).default('lecture'),
})
const roomTypeSchema = z.object({
    type: z.enum(roomUsageTypes),
})

export async function GET() {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    await connectDb()
    const records = await rooms.find({}).select('name type').sort({ name: 1 }).lean()
    return NextResponse.json({
        data: records.map((room) => ({
            id: room._id.toString(),
            name: room.name,
            type: normalizeRoomUsageType(room.type),
        })),
    })
}

export async function POST(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ message: 'Enter a valid room name and type.' }, { status: 400 })
    }

    const parsed = roomSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ message: 'Enter a room name up to 60 characters.' }, { status: 400 })

    await connectDb()
    const normalizedName = parsed.data.name.toLocaleLowerCase()
    try {
        const room = await rooms.create({ ...parsed.data, normalizedName })
        return NextResponse.json({
            data: { id: room._id.toString(), name: room.name, type: room.type },
        }, { status: 201 })
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
            return NextResponse.json({ message: 'A room with that name already exists.' }, { status: 409 })
        }
        throw error
    }
}

export async function PATCH(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const id = new URL(request.url).searchParams.get('id')
    if (!id || !mongoose.isValidObjectId(id)) {
        return NextResponse.json({ message: 'Invalid room id.' }, { status: 400 })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ message: 'Choose a valid room type.' }, { status: 400 })
    }

    const parsed = roomTypeSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ message: 'Choose Lecture, Lab, or Both for this room.' }, { status: 400 })
    }

    await connectDb()
    const room = await rooms.findByIdAndUpdate(
        id,
        { type: parsed.data.type },
        { new: true, runValidators: true },
    ).select('name type').lean()
    if (!room) return NextResponse.json({ message: 'Room not found.' }, { status: 404 })

    const updatedType = normalizeRoomUsageType(room.type)
    return NextResponse.json({
        data: { id: room._id.toString(), name: room.name, type: updatedType },
        message: `${room.name} updated to ${formatRoomUsageType(updatedType)}.`,
    })
}

export async function DELETE(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const id = new URL(request.url).searchParams.get('id')
    if (!id || !mongoose.isValidObjectId(id)) {
        return NextResponse.json({ message: 'Invalid room id.' }, { status: 400 })
    }

    await connectDb()
    const room = await rooms.findById(id).select('name').lean()
    if (!room) return NextResponse.json({ message: 'Room not found.' }, { status: 404 })
    if (await schedules.exists({
        room: room.name,
        $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
    })) {
        return NextResponse.json({ message: 'This room is assigned to a scheduled class. Reassign or remove those classes before deleting the room.' }, { status: 409 })
    }

    await rooms.findByIdAndDelete(id)
    return NextResponse.json({ message: 'Room removed.' })
}
