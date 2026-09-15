"use server"

import bcrypt from 'bcrypt'
import { cookies } from 'next/headers'
import { redirect} from 'next/navigation'
import connectDb from '@/lib/mongodb'
import { users } from '@/model/user'
import { LoginSchema, SignUpSchema, FormState } from './definition'

export async function login(state: FormState, formData: FormData) {
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

    const user = await users.findOne({ email }).lean()

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return {
            errors: {
                email: ['Invalid email or password'],
            },
        }
    }
    const sessionToken = crypto.randomUUID()

        const cookieStore = await cookies()
        cookieStore.set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        })
        redirect('/dashboard')
    }
    
export async function signup(state: FormState, formData: FormData) {
    const validatedFields = SignUpSchema.safeParse({
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    const { username, email: rawEmail, password } = validatedFields.data
    const email = rawEmail.toLowerCase()

    try {
        await connectDb()

        const existingUser = await users.exists({
            $or: [{ email }, { name: username }],
        })

        if (existingUser) {
            return {
                message: 'An account with that username or email already exists.',
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        await users.create({
            name: username,
            email,
            password: hashedPassword,
        })

        return {
            message: 'Account created successfully.',
        }
    } catch (error) {
        console.error('Error creating user:', error)
        return {
            message: 'An error occurred while creating your account. Please try again later.',
        }
    }
}

