import mongoose from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { announcements } from '@/model/announcement'
import { reaccessRequests } from '@/model/reaccess-request'
import { scheduleRequests } from '@/model/schedule-request'
import { schedules } from '@/model/schedule'
import { users } from '@/model/user'

const announcementInputSchema = z.object({
  title: z.string().trim().min(2, 'Enter a title (at least 2 characters).').max(100),
  message: z.string().trim().min(2, 'Enter a message (at least 2 characters).').max(500),
})

export async function GET() {
  const currentUser = await getAuthenticatedUser()
  if (!currentUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  await connectDb()

  const recentAnnouncements = await announcements
    .find({})
    .sort({ createdAt: -1 })
    .limit(15)
    .lean()

  const serializedAnnouncements = recentAnnouncements.map((item) => ({
    id: item._id.toString(),
    title: item.title,
    message: item.message,
    createdBy: item.createdBy,
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
  }))

  if (currentUser.role === 'admin') {
    const [pendingReaccessDocs, pendingScheduleDocs] = await Promise.all([
      reaccessRequests.find({ status: 'pending' }).sort({ requestedAt: -1 }).limit(15).lean(),
      scheduleRequests.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(15).lean(),
    ])

    const facultyIds = [
      ...new Set(pendingScheduleDocs.map((req) => req.facultyId.toString())),
    ]
    const facultyDocs = facultyIds.length
      ? await users.find({ _id: { $in: facultyIds } }).select('name email').lean()
      : []
    const facultyById = new Map(facultyDocs.map((f) => [f._id.toString(), f]))

    return NextResponse.json({
      role: 'admin',
      reaccessRequests: pendingReaccessDocs.map((doc) => ({
        email: doc.email,
        name: doc.userName ?? null,
        failedAttempts: doc.failedAttempts ?? 3,
        reason: doc.reason ?? null,
        requestedAt: doc.requestedAt
          ? new Date(doc.requestedAt).toISOString()
          : new Date().toISOString(),
      })),
      scheduleRequests: pendingScheduleDocs.map((doc) => {
        const faculty = facultyById.get(doc.facultyId.toString())
        return {
          id: doc._id.toString(),
          facultyName: faculty?.name ?? 'Faculty Member',
          subject: doc.subject,
          classType: doc.classType === 'lab' ? 'Lab' : 'Lecture',
          day: doc.day,
          startTime: doc.startTime,
          endTime: doc.endTime,
          createdAt: doc.createdAt
            ? new Date(doc.createdAt).toISOString()
            : new Date().toISOString(),
        }
      }),
      announcements: serializedAnnouncements,
    })
  }

  const [userScheduleRequests, assignedClasses] = await Promise.all([
    scheduleRequests
      .find({ facultyId: currentUser.id })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean(),
    schedules
      .find({
        facultyId: currentUser.id,
        $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
      })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
  ])

  return NextResponse.json({
    role: 'user',
    announcements: serializedAnnouncements,
    scheduleUpdates: userScheduleRequests.map((doc) => ({
      id: doc._id.toString(),
      subject: doc.subject,
      classType: doc.classType === 'lab' ? 'Lab' : 'Lecture',
      day: doc.day,
      startTime: doc.startTime,
      endTime: doc.endTime,
      status: doc.status as 'pending' | 'approved' | 'rejected',
      updatedAt: doc.updatedAt
        ? new Date(doc.updatedAt).toISOString()
        : doc.createdAt
          ? new Date(doc.createdAt).toISOString()
          : new Date().toISOString(),
    })),
    assignedClasses: assignedClasses.map((doc) => ({
      id: doc._id.toString(),
      subject: doc.subject,
      room: doc.room ?? '',
      day: doc.day ?? '',
      startTime: doc.startTime ?? '',
      endTime: doc.endTime ?? '',
      updatedAt: doc.updatedAt
        ? new Date(doc.updatedAt).toISOString()
        : new Date().toISOString(),
    })),
  })
}

export async function POST(request: NextRequest) {
  const currentUser = await getAuthenticatedUser()
  if (!currentUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  if (currentUser.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid announcement payload.' }, { status: 400 })
  }

  const parsed = announcementInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Enter a valid title and message.' },
      { status: 400 },
    )
  }

  await connectDb()
  const created = await announcements.create({
    title: parsed.data.title,
    message: parsed.data.message,
    createdBy: currentUser.name,
    createdByEmail: currentUser.email,
  })

  return NextResponse.json(
    {
      data: {
        id: created._id.toString(),
        title: created.title,
        message: created.message,
        createdBy: created.createdBy,
        createdAt: created.createdAt
          ? new Date(created.createdAt).toISOString()
          : new Date().toISOString(),
      },
      message: 'Announcement posted to all users.',
    },
    { status: 201 },
  )
}

export async function DELETE(request: NextRequest) {
  const currentUser = await getAuthenticatedUser()
  if (!currentUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  if (currentUser.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: 'Invalid announcement id.' }, { status: 400 })
  }

  await connectDb()
  const deleted = await announcements.findByIdAndDelete(id)
  if (!deleted) {
    return NextResponse.json({ message: 'Announcement not found.' }, { status: 404 })
  }

  return NextResponse.json({ message: 'Announcement removed.' })
}
