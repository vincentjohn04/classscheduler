import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { sessions } from '@/model/session'
import { schedules } from '@/model/schedule'
import { users } from '@/model/user'

const updateUserSchema = z.object({
    id: z.string().refine(mongoose.isValidObjectId, 'Invalid user id'),
    name: z.string().trim().min(2).max(80),
    email: z.email().trim().toLowerCase(),
    role: z.enum(['user', 'admin']),
})

export async function GET() {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    await connectDb()
    const accountRecords = await users.find({})
        .select('name email role createdAt updatedAt')
        .sort({ createdAt: -1, name: 1 })
        .lean()
    const recentCount = await users.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })

    return NextResponse.json({
        data: accountRecords.map((account) => ({
            id: account._id.toString(),
            name: account.name,
            email: account.email,
            role: account.role === 'admin' ? 'admin' : 'user',
            createdAt: account.createdAt ?? null,
            updatedAt: account.updatedAt ?? null,
        })),
        recentCount,
    })
}

export async function PATCH(request: NextRequest) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const parsed = updateUserSchema.safeParse(await request.json())
    if (!parsed.success) {
        return NextResponse.json({ message: 'Check the name, email, and role fields.' }, { status: 400 })
    }
    if (parsed.data.id === currentUser.id && parsed.data.role !== 'admin') {
        return NextResponse.json({ message: 'You cannot remove your own admin role.' }, { status: 400 })
    }

    await connectDb()
    const target = await users.findById(parsed.data.id).select('role').lean()
    if (!target) return NextResponse.json({ message: 'Account not found.' }, { status: 404 })

    if (target.role === 'admin' && parsed.data.role === 'user') {
        const adminCount = await users.countDocuments({ role: 'admin' })
        if (adminCount <= 1) {
            return NextResponse.json({ message: 'The last administrator cannot be demoted.' }, { status: 409 })
        }
    }
    if (target.role === 'user' && parsed.data.role === 'admin' && await schedules.exists({ facultyId: parsed.data.id })) {
        return NextResponse.json({
            message: 'Remove this faculty member’s scheduled or queued classes before changing their role to administrator.',
        }, { status: 409 })
    }

    try {
        const updated = await users.findByIdAndUpdate(
            parsed.data.id,
            { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role },
            { new: true, runValidators: true },
        ).select('name email role createdAt updatedAt').lean()

        return NextResponse.json({ data: updated })
    } catch (error) {
        if (error instanceof mongoose.Error || (error && typeof error === 'object' && 'code' in error && error.code === 11000)) {
            return NextResponse.json({ message: 'That username or email is already in use.' }, { status: 409 })
        }
        throw error
    }
}

export async function DELETE(request: NextRequest) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id || !mongoose.isValidObjectId(id)) {
        return NextResponse.json({ message: 'Invalid account id.' }, { status: 400 })
    }
    if (id === currentUser.id) {
        return NextResponse.json({ message: 'You cannot delete your own account.' }, { status: 400 })
    }

    await connectDb()
    const target = await users.findById(id).select('role').lean()
    if (!target) return NextResponse.json({ message: 'Account not found.' }, { status: 404 })
    if (target.role === 'admin' && await users.countDocuments({ role: 'admin' }) <= 1) {
        return NextResponse.json({ message: 'The last administrator cannot be deleted.' }, { status: 409 })
    }

    await users.findByIdAndDelete(id)
    await sessions.deleteMany({ userId: new mongoose.Types.ObjectId(id) })
    await schedules.deleteMany({ facultyId: id })
    return NextResponse.json({ message: 'Account deleted.' })
}