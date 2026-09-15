import * as z from 'zod'

export const SignUpSchema = z.object({
username: z
    .string()
    .min(8, {error: 'Name must be at least 8 characters long'})
    .trim(),
email:z.email({error: 'Please enter a valid email address'}).trim(),
password: z
    .string()
    .min(8, {error: 'Password must be at least 8 characters long'})
    .regex(/[a-zA-Z]/, {error: 'Password must contain at least one letter'})
    .regex(/[0-9]/, {error: 'Password must contain at least one number'})
    .regex(/[^a-zA-Z0-9]/, {error: 'Password must contain at least one special character'})
    .trim(),
})

export type FormState =
 | {
    errors?: {
        username?: string[]
        email?: string[]
        password?: string[]
    }
    message?: string
 }
 | undefined

 export const LoginSchema = z.object({
    email: z.email({error: 'Please enter a valid email address'}).trim(),
     password: z.string().min(1, {error: 'Password is required'}).trim()
 })

