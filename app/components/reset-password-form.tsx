'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { resetPassword } from '@/app/api/server/auth/auth'

export default function ResetPasswordForm({ token }: { token: string }) {
    const [state, action, pending] = useActionState(resetPassword, undefined)

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#fbf8f7] px-4 py-8">
            <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
                <h1 className="text-3xl font-extrabold text-[#5D1A25]">Set a new password</h1>
                <p className="mt-3 text-gray-600">Choose a new password for your Chronyx account.</p>
                <form action={action} className="mt-6">
                    <input type="hidden" name="token" value={token} />
                    <label htmlFor="new-password" className="mt-4 block text-[#5D1A25]">New password</label>
                    <input
                        id="new-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]"
                    />
                    {state?.errors?.password?.map((error) => <p key={error} className="mt-1 text-sm text-red-600">{error}</p>)}

                    <label htmlFor="confirm-new-password" className="mt-4 block text-[#5D1A25]">Confirm new password</label>
                    <input
                        id="confirm-new-password"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]"
                    />
                    {state?.errors?.confirmPassword?.map((error) => <p key={error} className="mt-1 text-sm text-red-600">{error}</p>)}
                    {state?.errors?.token?.map((error) => <p key={error} className="mt-3 text-sm text-red-600">{error}</p>)}
                    {state?.message && <p role="status" className="mt-3 text-sm text-green-700">{state.message}</p>}

                    {!state?.message && (
                        <button disabled={pending} type="submit" className="mt-6 rounded-md bg-[#5D1A25] px-4 py-2 text-white disabled:opacity-60">
                            {pending ? 'Updating...' : 'Update password'}
                        </button>
                    )}
                </form>
                <Link href="/login" className="mt-5 inline-block text-[#5D1A25] underline">Return to login</Link>
            </section>
        </main>
    )
}