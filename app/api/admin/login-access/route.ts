import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { loginAttempts } from '@/model/login-attempt'
import { reaccessRequests } from '@/model/reaccess-request'
import { users } from '@/model/user'

const approveSchema = z.object({
  email: z.email().trim().toLowerCase(),
})

export async function GET() {
  const currentUser = await getAuthenticatedUser()
  if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  await connectDb()
  const pendingDocs = await reaccessRequests
    .find({ status: 'pending' })
    .sort({ requestedAt: -1 })
    .lean()

  const emails = pendingDocs.map((record) => record.email)
  const matchedUsers = emails.length
    ? await users.find({ email: { $in: emails } }).select('name email role').lean()
    : []
  const userByEmail = new Map(matchedUsers.map((account) => [account.email, account]))

  return NextResponse.json({
    data: pendingDocs.map((record) => {
      const account = userByEmail.get(record.email)
      return {
        email: record.email,
        name: account?.name ?? record.userName ?? null,
        role: account?.role ?? record.userRole ?? null,
        failedAttempts: record.failedAttempts ?? 3,
        reaccessRequestedAt: record.requestedAt
          ? new Date(record.requestedAt).toISOString()
          : null,
        reaccessReason: record.reason ?? null,
        expiresAt: null,
      }
    }),
  })
}

export async function POST(request: NextRequest) {
  const currentUser = await getAuthenticatedUser()
  if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const parsed = approveSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid email address.' }, { status: 400 })
  }

  await connectDb()
  const now = new Date()
  const updated = await reaccessRequests.findOneAndUpdate(
    { email: parsed.data.email, status: 'pending' },
    {
      $set: {
        status: 'approved',
        approvedAt: now,
        approvedBy: currentUser.email,
      },
    },
    { new: true },
  )

  if (!updated) {
    return NextResponse.json(
      { message: 'No pending user re-access request was found for that account.' },
      { status: 404 },
    )
  }

  await loginAttempts.deleteOne({ email: parsed.data.email })
  revalidatePath('/adminDashboard')

  return NextResponse.json({
    message: `Re-access approved for ${parsed.data.email}. They can now sign in.`,
  })
}
