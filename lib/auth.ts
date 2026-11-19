import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import connectDb from '@/lib/mongodb'
import { sessions } from '@/model/session'
import { users } from '@/model/user'

export type AuthenticatedUser = {
    id: string
    name: string
    email: string
    role: 'user' | 'admin'
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
    const sessionToken = (await cookies()).get('session')?.value
    if (!sessionToken) return null

    await connectDb()
    const tokenHash = createHash('sha256').update(sessionToken).digest('hex')
    const session = await sessions.findOne({ tokenHash, expiresAt: { $gt: new Date() } }).lean()
    if (!session) return null

    const user = await users.findById(session.userId).select('name email role').lean()
    if (!user) return null

    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role === 'admin' ? 'admin' : 'user',
    }
}