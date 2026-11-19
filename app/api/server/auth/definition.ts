import * as z from 'zod'

export const MAX_ADMIN_ACCOUNTS = 2

export const SignUpSchema = z.object({
role: z.enum(['user', 'admin'], {error: 'Please select a valid role'}),
username: z
    .string()
    .min(8, {error: 'Name must be at least 8 characters long'})
    .trim(),
email: z
    .email({ error: 'Please enter a valid email address' })
    .trim()
    .refine((email) => /@gmail\.com$/i.test(email), {
        error: 'Please use an email address ending in @gmail.com',
    }),
password: z
    .string()
    .min(8, {error: 'Password must be at least 8 characters long'})
    .regex(/[a-zA-Z]/, {error: 'Password must contain at least one letter'})
    .regex(/[0-9]/, {error: 'Password must contain at least one number'})
    .regex(/[^a-zA-Z0-9]/, {error: 'Password must contain at least one special character'})
    .trim(),
confirmPassword: z.string().min(1, {error: 'Please confirm your password'}),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
})

export type FormState =
 | {
    errors?: {
        role?: string[],
        username?: string[]
        email?: string[]
        password?: string[]
        confirmPassword?: string[]
        verification?: string[]
    }
    message?: string
    accountLocked?: boolean
    failedAttempts?: number
    maxAttempts?: number
    verificationRequired?: boolean
    verificationEmail?: string
    otpMessage?: string
    reaccessRequested?: boolean
 }
 | undefined

export type PasswordResetRequestState = {
    errors?: {
        email?: string[]
    }
    message?: string
} | undefined

export type PasswordResetState = {
    errors?: {
        token?: string[]
        password?: string[]
        confirmPassword?: string[]
    }
    message?: string
} | undefined

export type UpdateNameState = {
    errors?: {
        name?: string[]
    }
    message?: string
    success?: boolean
    updatedName?: string
} | undefined

export type ChangePasswordState = {
    errors?: {
        currentPassword?: string[]
        newPassword?: string[]
        confirmPassword?: string[]
    }
    message?: string
    success?: boolean
} | undefined

export type DeleteAccountState = {
    errors?: {
        password?: string[]
        confirmation?: string[]
    }
    message?: string
} | undefined

export const DeleteAccountSchema = z.object({
    password: z.string().min(1, { error: 'Enter your current password to confirm' }),
    confirmation: z
        .string()
        .trim()
        .refine((value) => value === 'DELETE', {
            error: 'Type DELETE in all caps to confirm account deletion',
        }),
})

export const UpdateNameSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, { error: 'Name must be at least 2 characters long' })
        .max(80, { error: 'Name must be at most 80 characters long' }),
})

export const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1, { error: 'Current password is required' }),
    newPassword: z
        .string()
        .min(8, { error: 'Password must be at least 8 characters long' })
        .regex(/[a-zA-Z]/, { error: 'Password must contain at least one letter' })
        .regex(/[0-9]/, { error: 'Password must contain at least one number' })
        .regex(/[^a-zA-Z0-9]/, { error: 'Password must contain at least one special character' }),
    confirmPassword: z.string().min(1, { error: 'Please confirm your new password' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
})

 export const LoginSchema = z.object({
    email: z.email({error: 'Please enter a valid email address'}).trim(),
     password: z.string().min(1, {error: 'Password is required'}).trim()
 })

export const PasswordResetRequestSchema = z.object({
    email: z.email({ error: 'Please enter a valid email address' }).trim(),
})

export const PasswordResetSchema = z.object({
    token: z.string().min(1, { error: 'This reset link is invalid or expired.' }).max(128),
    password: z
        .string()
        .min(8, { error: 'Password must be at least 8 characters long' })
        .regex(/[a-zA-Z]/, { error: 'Password must contain at least one letter' })
        .regex(/[0-9]/, { error: 'Password must contain at least one number' })
        .regex(/[^a-zA-Z0-9]/, { error: 'Password must contain at least one special character' }),
    confirmPassword: z.string().min(1, { error: 'Please confirm your password' }),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
})
