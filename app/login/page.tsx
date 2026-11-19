import type { Metadata } from 'next'
import connectDb from '@/lib/mongodb'
import { users } from '@/model/user'
import { MAX_ADMIN_ACCOUNTS } from '@/app/api/server/auth/definition'
import LoginPage from '../components/loginpage'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in or create your Chronyx academic scheduling account.',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>
}) {
  const { mode } = await searchParams
  const initialMode = mode === 'signup' ? 'signup' : 'login'

  let canRegisterAdmin = false
  try {
    await connectDb()
    const adminCount = await users.countDocuments({ role: 'admin' })
    canRegisterAdmin = adminCount < MAX_ADMIN_ACCOUNTS
  } catch (error) {
    console.error('Unable to check admin registration availability:', error)
    canRegisterAdmin = false
  }

  return (
    <LoginPage
      initialMode={initialMode}
      canRegisterAdmin={canRegisterAdmin}
      maxAdminAccounts={MAX_ADMIN_ACCOUNTS}
    />
  )
}
