"use server"

import bcrypt from 'bcryptjs'
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { loginAttempts } from '@/model/login-attempt'
import { passwordResetTokens } from '@/model/password-reset-token'
import { reaccessRequests } from '@/model/reaccess-request'
import { scheduleRequests } from '@/model/schedule-request'
import { schedules } from '@/model/schedule'
import { sessions } from '@/model/session'
import { users } from '@/model/user'
import {
    ChangePasswordSchema,
    ChangePasswordState,
    DeleteAccountSchema,
    DeleteAccountState,
    FormState,
    LoginSchema,
    MAX_ADMIN_ACCOUNTS,
    PasswordResetRequestSchema,
    PasswordResetRequestState,
    PasswordResetSchema,
    PasswordResetState,
    SignUpSchema,
    UpdateNameSchema,
    UpdateNameState,
} from './definition'

const sessionDurationSeconds = 60 * 60 * 24 * 7
const maxFailedLoginAttempts = 3
const loginAttemptWindowMs = 15 * 60 * 1000
const otpDurationMs = 10 * 60 * 1000
const otpResendCooldownMs = 60 * 1000
const reaccessRequestWindowMs = 24 * 60 * 60 * 1000
const passwordResetDurationMs = 30 * 60 * 1000
const passwordResetRequestCooldownMs = 60 * 1000

function getEmailDeliveryConfiguration() {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM_EMAIL

    if (!apiKey || !from) {
        return null
    }

    return { apiKey, from }
}

function getPasswordResetConfiguration() {
    const emailConfig = getEmailDeliveryConfiguration()
    const appUrl = process.env.APP_URL

    if (!emailConfig || !appUrl) {
        throw new Error('Password reset requires RESEND_API_KEY, RESEND_FROM_EMAIL, and APP_URL.')
    }

    const parsedAppUrl = new URL(appUrl)
    if (
        !['http:', 'https:'].includes(parsedAppUrl.protocol)
        || parsedAppUrl.username
        || parsedAppUrl.password
    ) {
        throw new Error('APP_URL must be a valid HTTP or HTTPS application origin.')
    }
    if (process.env.NODE_ENV === 'production' && parsedAppUrl.protocol !== 'https:') {
        throw new Error('APP_URL must use HTTPS in production.')
    }

    return { apiKey: emailConfig.apiKey, from: emailConfig.from, appUrl: parsedAppUrl.origin }
}

async function issueLoginOtp(email: string): Promise<{ sent: boolean; message: string }> {
    const now = new Date()
    const attempt = await loginAttempts.findOne({
        email,
        expiresAt: { $gt: now },
        failedAttempts: { $gte: maxFailedLoginAttempts },
    }).lean()

    if (!attempt) {
        return {
            sent: false,
            message: 'No active login verification lock was found for that email. You can sign in normally.',
        }
    }

    const emailConfig = getEmailDeliveryConfiguration()
    if (!emailConfig) {
        return {
            sent: false,
            message: 'Email OTP delivery is currently unavailable. Request administrator re-access approval below to unlock your account.',
        }
    }

    if (
        attempt.otp?.sentAt
        && attempt.otp.expiresAt
        && attempt.otp.expiresAt > now
        && now.getTime() - new Date(attempt.otp.sentAt).getTime() < otpResendCooldownMs
    ) {
        return {
            sent: false,
            message: 'A 6-digit OTP was recently sent. Check your inbox or wait a minute before resending.',
        }
    }

    const code = String(randomInt(100000, 1000000))
    const otp = {
        codeHash: createHash('sha256').update(code).digest('hex'),
        expiresAt: new Date(now.getTime() + otpDurationMs),
        sentAt: now,
    }

    const existingUser = await users.findOne({ email }).select('_id').lean()
    await loginAttempts.updateOne({ email }, { $set: { otp } })

    if (existingUser) {
        let response: Response
        try {
            response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${emailConfig.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: emailConfig.from,
                    to: [email],
                    subject: 'Your Chronyx login verification code',
                    html: `<p>Use this 6-digit verification code to sign in to your Chronyx account:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>This code expires in 10 minutes. If you did not try to sign in, you can ignore this email or contact an administrator.</p>`,
                }),
            })
        } catch (error) {
            await loginAttempts.updateOne({ email }, { $unset: { otp: 1 } })
            console.error('Unable to send login OTP email:', error)
            return {
                sent: false,
                message: 'Unable to send OTP right now. Try resending or request administrator re-access approval below.',
            }
        }

        if (!response.ok) {
            await loginAttempts.updateOne({ email }, { $unset: { otp: 1 } })
            console.error(`Login OTP email delivery failed with status ${response.status}.`)
            return {
                sent: false,
                message: 'Unable to send OTP right now. Try resending or request administrator re-access approval below.',
            }
        }
    }

    return {
        sent: true,
        message: 'If an account matches that email, a 6-digit OTP code has been sent. Enter it below or request administrator re-access approval.',
    }
}

export async function resendLoginOtp(rawEmail: string): Promise<{ ok: boolean; message: string }> {
    const parsedEmail = PasswordResetRequestSchema.safeParse({ email: rawEmail })
    if (!parsedEmail.success) {
        return { ok: false, message: 'Enter a valid email address first.' }
    }

    await connectDb()
    const result = await issueLoginOtp(parsedEmail.data.email.toLowerCase())
    return { ok: result.sent, message: result.message }
}

async function notifyAdminsOfReaccessRequest(params: {
    email: string
    userName?: string | null
    reason?: string
}) {
    const emailConfig = getEmailDeliveryConfiguration()
    if (!emailConfig) return

    try {
        const adminDocs = await users.find({ role: 'admin' }).select('email').lean()
        const adminEmails = adminDocs
            .map((admin) => admin.email)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)

        if (!adminEmails.length) return

        const displayUser = params.userName ? `${params.userName} (${params.email})` : params.email
        const reasonBlock = params.reason
            ? `<p><strong>User note:</strong> ${params.reason.replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch] ?? ch))}</p>`
            : ''

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${emailConfig.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: emailConfig.from,
                to: adminEmails,
                subject: `Chronyx re-access request from ${params.email}`,
                html: `<p><strong>${displayUser}</strong> was locked out after multiple failed login attempts and requested administrator re-access approval.</p>${reasonBlock}<p>Sign in to the Chronyx Admin Dashboard to review and approve re-access.</p>`,
            }),
        })

        if (!response.ok) {
            console.error(`Admin re-access notification email failed with status ${response.status}.`)
        }
    } catch (error) {
        console.error('Unable to send admin re-access notification email:', error)
    }
}

export async function requestAdminReaccess(
    rawEmail: string,
    rawReason?: string,
): Promise<{ ok: boolean; message: string }> {
    const parsedEmail = PasswordResetRequestSchema.safeParse({ email: rawEmail })
    if (!parsedEmail.success) {
        return { ok: false, message: 'Enter a valid email address first.' }
    }

    const email = parsedEmail.data.email.toLowerCase()
    const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, 200) : ''
    const now = new Date()

    await connectDb()
    const attempt = await loginAttempts.findOne({
        email,
        expiresAt: { $gt: now },
        failedAttempts: { $gte: maxFailedLoginAttempts },
    }).lean()

    if (!attempt) {
        return {
            ok: false,
            message: 'Your account is not currently locked. You can sign in normally.',
        }
    }

    const matchedUser = await users.findOne({ email }).select('name role').lean()

    await reaccessRequests.findOneAndUpdate(
        { email },
        {
            $set: {
                email,
                userName: matchedUser?.name ?? null,
                userRole: matchedUser?.role ?? null,
                failedAttempts: attempt.failedAttempts,
                reason: reason || null,
                status: 'pending',
                requestedAt: now,
            },
            $unset: {
                approvedAt: 1,
                approvedBy: 1,
            },
        },
        { upsert: true, new: true },
    )

    const extendedExpiry = new Date(now.getTime() + reaccessRequestWindowMs)
    const currentExpiry = new Date(attempt.expiresAt)
    await loginAttempts.updateOne(
        { email },
        {
            $set: {
                reaccessRequestedAt: now,
                ...(reason ? { reaccessReason: reason } : {}),
                expiresAt: currentExpiry > extendedExpiry ? currentExpiry : extendedExpiry,
            },
        },
        { strict: false },
    )

    await notifyAdminsOfReaccessRequest({
        email,
        userName: matchedUser?.name,
        reason,
    })

    revalidatePath('/adminDashboard')

    return {
        ok: true,
        message: 'Re-access request submitted to administrators. Admins have been notified.',
    }
}

async function createSession(userId: string) {
    const sessionToken = randomUUID()
    const expiresAt = new Date(Date.now() + sessionDurationSeconds * 1000)
    await sessions.create({
        tokenHash: createHash('sha256').update(sessionToken).digest('hex'),
        userId,
        expiresAt,
    })

    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: sessionDurationSeconds,
        expires: expiresAt,
    })
}

export async function login(state: FormState, formData: FormData): Promise<FormState> {
    const validateFields = LoginSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    })

    if (!validateFields.success) {
        return {
            errors: validateFields.error.flatten().fieldErrors,
        }
    }

    const { email: rawEmail, password } = validateFields.data
    const email = rawEmail.toLowerCase()

    await connectDb()

    const now = new Date()
    const attempt = await loginAttempts.findOne({
        email,
        expiresAt: { $gt: now },
    }).lean()
    if (attempt && attempt.failedAttempts >= maxFailedLoginAttempts) {
        const otpCode = String(formData.get('otpCode') ?? '').trim()
        const expectedHash = attempt.otp?.codeHash
        let isVerified = false

        if (
            /^\d{6}$/.test(otpCode)
            && expectedHash
            && attempt.otp?.expiresAt
            && attempt.otp.expiresAt > now
        ) {
            const codeHash = createHash('sha256').update(otpCode).digest('hex')
            if (Buffer.from(codeHash, 'hex').length === Buffer.from(expectedHash, 'hex').length) {
                isVerified = timingSafeEqual(
                    Buffer.from(codeHash, 'hex'),
                    Buffer.from(expectedHash, 'hex'),
                )
            }
        }

        if (!isVerified) {
            let otpMessage = 'Enter the 6-digit OTP sent to your email, or request administrator re-access approval.'
            if (!attempt.otp || !attempt.otp.expiresAt || attempt.otp.expiresAt <= now) {
                const issued = await issueLoginOtp(email)
                otpMessage = issued.message
            }

            const pendingReaccess = await reaccessRequests.exists({ email, status: 'pending' })
            return {
                errors: {
                    verification: [
                        otpCode
                            ? 'Invalid or expired OTP code. Please try again, resend OTP, or submit a re-access request.'
                            : 'Your account is locked. Enter your 6-digit OTP or submit an admin re-access request below.',
                    ],
                },
                accountLocked: true,
                failedAttempts: attempt.failedAttempts,
                maxAttempts: maxFailedLoginAttempts,
                verificationRequired: true,
                verificationEmail: email,
                otpMessage,
                reaccessRequested: Boolean(pendingReaccess),
            }
        }
    }

    const user = await users.findOne({ email }).lean()

    if (!user || !(await bcrypt.compare(password, user.password))) {
        const defaultExpiry = new Date(now.getTime() + loginAttemptWindowMs)
        await loginAttempts.updateOne(
            { email },
            [
                {
                    $set: {
                        email,
                        failedAttempts: {
                            $cond: [
                                { $gt: ['$expiresAt', now] },
                                { $add: [{ $ifNull: ['$failedAttempts', 0] }, 1] },
                                1,
                            ],
                        },
                        otp: {
                            $cond: [
                                { $gt: ['$expiresAt', now] },
                                '$otp',
                                '$$REMOVE',
                            ],
                        },
                        reaccessRequestedAt: {
                            $cond: [
                                { $gt: ['$expiresAt', now] },
                                '$reaccessRequestedAt',
                                '$$REMOVE',
                            ],
                        },
                        reaccessReason: {
                            $cond: [
                                { $gt: ['$expiresAt', now] },
                                '$reaccessReason',
                                '$$REMOVE',
                            ],
                        },
                        expiresAt: {
                            $cond: [
                                { $gt: ['$expiresAt', defaultExpiry] },
                                '$expiresAt',
                                defaultExpiry,
                            ],
                        },
                    },
                },
            ],
            { upsert: true, updatePipeline: true },
        )

        const updatedAttempt = await loginAttempts.findOne({ email }).lean()
        const failedCount = updatedAttempt?.failedAttempts ?? 1
        if (updatedAttempt && failedCount >= maxFailedLoginAttempts) {
            let otpMessage = 'Enter the 6-digit OTP sent to your email, or submit an administrator re-access request below.'
            if (!updatedAttempt.otp || !updatedAttempt.otp.expiresAt || updatedAttempt.otp.expiresAt <= now) {
                const issued = await issueLoginOtp(email)
                otpMessage = issued.message
            }
            const pendingReaccess = await reaccessRequests.exists({ email, status: 'pending' })
            return {
                errors: {
                    email: ['Invalid email or password'],
                },
                accountLocked: true,
                failedAttempts: failedCount,
                maxAttempts: maxFailedLoginAttempts,
                verificationRequired: true,
                verificationEmail: email,
                otpMessage,
                reaccessRequested: Boolean(pendingReaccess),
            }
        }
        return {
            errors: {
                email: ['Invalid email or password'],
            },
            accountLocked: false,
            failedAttempts: failedCount,
            maxAttempts: maxFailedLoginAttempts,
        }
    }

    await Promise.all([
        loginAttempts.deleteOne({ email }),
        reaccessRequests.deleteOne({ email }),
    ])
    revalidatePath('/adminDashboard')
    await createSession(user._id.toString())
    redirect(user.role === 'admin' ? '/adminDashboard' : '/dashboard')
}

export async function requestPasswordReset(
    state: PasswordResetRequestState,
    formData: FormData,
): Promise<PasswordResetRequestState> {
    const validatedFields = PasswordResetRequestSchema.safeParse({
        email: formData.get('email'),
    })

    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    let config: ReturnType<typeof getPasswordResetConfiguration>
    try {
        config = getPasswordResetConfiguration()
    } catch (error) {
        console.error('Password reset configuration error:', error)
        return {
            message: 'Password reset email delivery is currently unavailable. Please contact an administrator.',
        }
    }

    const { apiKey, from, appUrl } = config
    const email = validatedFields.data.email.toLowerCase()

    await connectDb()
    const user = await users.findOne({ email }).select('_id').lean()

    if (user) {
        const cooldownStartedAt = new Date(Date.now() - passwordResetRequestCooldownMs)
        const recentRequest = await passwordResetTokens.exists({
            userId: user._id,
            createdAt: { $gt: cooldownStartedAt },
        })

        if (!recentRequest) {
            const token = randomBytes(32).toString('base64url')
            const tokenHash = createHash('sha256').update(token).digest('hex')

            await passwordResetTokens.create({
                tokenHash,
                userId: user._id,
                expiresAt: new Date(Date.now() + passwordResetDurationMs),
            })

            const resetUrl = new URL('/reset-password', appUrl)
            resetUrl.searchParams.set('token', token)

            let response: Response
            try {
                response = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from,
                        to: [email],
                        subject: 'Reset your Chronyx password',
                        html: `<p>We received a request to reset your Chronyx password.</p><p><a href="${resetUrl.toString()}">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once. If you did not request a reset, you can ignore this email.</p>`,
                    }),
                })
            } catch (error) {
                await passwordResetTokens.deleteOne({ tokenHash })
                console.error('Unable to send password reset email:', error)
                return { message: 'If an account matches that email, reset instructions will be sent if email delivery is available.' }
            }

            if (!response.ok) {
                await passwordResetTokens.deleteOne({ tokenHash })
                console.error(`Password reset email delivery failed with status ${response.status}.`)
            }
        }
    }

    return { message: 'If an account matches that email, reset instructions will be sent if email delivery is available.' }
}

export async function resetPassword(
    state: PasswordResetState,
    formData: FormData,
): Promise<PasswordResetState> {
    const validatedFields = PasswordResetSchema.safeParse({
        token: formData.get('token'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
    })

    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    await connectDb()

    const tokenHash = createHash('sha256').update(validatedFields.data.token).digest('hex')
    const resetToken = await passwordResetTokens.findOneAndDelete({
        tokenHash,
        expiresAt: { $gt: new Date() },
    }).lean()

    if (!resetToken) {
        return { errors: { token: ['This reset link is invalid or expired.'] } }
    }

    const hashedPassword = await bcrypt.hash(validatedFields.data.password, 10)
    const result = await users.updateOne(
        { _id: resetToken.userId },
        { $set: { password: hashedPassword } },
    )

    if (result.matchedCount !== 1) {
        throw new Error('Password reset token references a missing user.')
    }

    await sessions.deleteMany({ userId: resetToken.userId })
    return { message: 'Your password has been reset. You can now log in.' }
}
    
export async function signup(state: FormState, formData: FormData): Promise<FormState> {
    const validatedFields = SignUpSchema.safeParse({
        role: formData.get('role'),
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    const { role, username, email: rawEmail, password } = validatedFields.data
    const email = rawEmail.toLowerCase()
    let accountId: string

    try {
        await connectDb()

        if (role === 'admin') {
            const adminCount = await users.countDocuments({ role: 'admin' })
            if (adminCount >= MAX_ADMIN_ACCOUNTS) {
                return {
                    errors: {
                        role: [
                            `Admin registration is closed (maximum of ${MAX_ADMIN_ACCOUNTS} admin accounts reached).`,
                        ],
                    },
                }
            }
        }

        const existingUser = await users.exists({
            $or: [{ email }, { name: username }],
        })

        if (existingUser) {
            return {
                message: 'An account with that username or email already exists.',
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const account = await users.create({
            role,
            name: username,
            email,
            password: hashedPassword,
        })
        accountId = account._id.toString()
    } catch (error) {
        console.error('Error creating user:', error)
        return {
            message: 'An error occurred while creating your account. Please try again later.',
        }
    }

    await createSession(accountId)
    redirect(role === 'admin' ? '/adminDashboard' : '/dashboard')
}

export async function updateOwnName(
    state: UpdateNameState,
    formData: FormData,
): Promise<UpdateNameState> {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) {
        return { message: 'You must be signed in to update your name.' }
    }

    const validatedFields = UpdateNameSchema.safeParse({
        name: formData.get('name'),
    })
    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    const nextName = validatedFields.data.name
    if (nextName === currentUser.name) {
        return {
            success: true,
            updatedName: nextName,
            message: 'Your name is already up to date.',
        }
    }

    try {
        await connectDb()
        const existingUser = await users.exists({
            name: nextName,
            _id: { $ne: currentUser.id },
        })
        if (existingUser) {
            return {
                errors: {
                    name: ['That name is already taken by another account.'],
                },
            }
        }

        await users.updateOne(
            { _id: currentUser.id },
            { $set: { name: nextName } },
        )
    } catch (error) {
        console.error('Error updating user name:', error)
        return { message: 'Unable to update your name right now. Please try again.' }
    }

    revalidatePath('/dashboard')
    revalidatePath('/adminDashboard')
    revalidatePath('/settings')
    revalidatePath('/adminDashboard/settings')

    return {
        success: true,
        updatedName: nextName,
        message: 'Your name has been updated.',
    }
}

export async function changeOwnPassword(
    state: ChangePasswordState,
    formData: FormData,
): Promise<ChangePasswordState> {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) {
        return { message: 'You must be signed in to change your password.' }
    }

    const validatedFields = ChangePasswordSchema.safeParse({
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword'),
        confirmPassword: formData.get('confirmPassword'),
    })
    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    const { currentPassword, newPassword } = validatedFields.data

    try {
        await connectDb()
        const dbUser = await users.findById(currentUser.id).select('password').lean()
        if (!dbUser) {
            return { message: 'Account not found.' }
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, dbUser.password)
        if (!isCurrentPasswordValid) {
            return {
                errors: {
                    currentPassword: ['Current password is incorrect.'],
                },
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)
        await users.updateOne(
            { _id: currentUser.id },
            { $set: { password: hashedPassword } },
        )

        const sessionToken = (await cookies()).get('session')?.value
        if (sessionToken) {
            const currentTokenHash = createHash('sha256').update(sessionToken).digest('hex')
            await sessions.deleteMany({
                userId: currentUser.id,
                tokenHash: { $ne: currentTokenHash },
            })
        }
    } catch (error) {
        console.error('Error changing password:', error)
        return { message: 'Unable to change your password right now. Please try again.' }
    }

    return {
        success: true,
        message: 'Your password has been changed successfully.',
    }
}

export async function deleteOwnAccount(
    state: DeleteAccountState,
    formData: FormData,
): Promise<DeleteAccountState> {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) {
        return { message: 'You must be signed in to delete your account.' }
    }

    const validatedFields = DeleteAccountSchema.safeParse({
        password: formData.get('password'),
        confirmation: formData.get('confirmation'),
    })
    if (!validatedFields.success) {
        return { errors: validatedFields.error.flatten().fieldErrors }
    }

    try {
        await connectDb()

        const dbUser = await users.findById(currentUser.id).select('password role email').lean()
        if (!dbUser) {
            return { message: 'Account not found.' }
        }

        const isPasswordValid = await bcrypt.compare(validatedFields.data.password, dbUser.password)
        if (!isPasswordValid) {
            return {
                errors: {
                    password: ['Password is incorrect.'],
                },
            }
        }

        if (dbUser.role === 'admin') {
            const adminCount = await users.countDocuments({ role: 'admin' })
            if (adminCount <= 1) {
                return {
                    message:
                        'You are the only administrator account. Add or promote another administrator before deleting your account.',
                }
            }
        }

        await Promise.all([
            users.findByIdAndDelete(currentUser.id),
            sessions.deleteMany({ userId: currentUser.id }),
            passwordResetTokens.deleteMany({ userId: currentUser.id }),
            schedules.deleteMany({ facultyId: currentUser.id }),
            scheduleRequests.deleteMany({ facultyId: currentUser.id }),
            loginAttempts.deleteOne({ email: dbUser.email }),
            reaccessRequests.deleteOne({ email: dbUser.email }),
        ])
    } catch (error) {
        console.error('Error deleting own account:', error)
        return { message: 'Unable to delete your account right now. Please try again.' }
    }

    const cookieStore = await cookies()
    cookieStore.delete('session')
    revalidatePath('/login')
    revalidatePath('/dashboard')
    revalidatePath('/adminDashboard')
    redirect('/login')
}

export async function logout() {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (sessionToken) {
        await connectDb()
        const tokenHash = createHash('sha256').update(sessionToken).digest('hex')
        await sessions.deleteOne({ tokenHash })
    }

    cookieStore.delete('session')
    redirect('/login')
}
