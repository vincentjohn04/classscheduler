/* eslint-disable @next/next/no-img-element */
import { redirect } from 'next/navigation'
import AccountMenu from '@/app/components/account-menu'
import AdminNavigation from '@/app/components/admin-navigation'
import SettingsManager from '@/app/adminDashboard/settings/settings-manager'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { getSchedulePolicy } from '@/lib/schedule-policy'
import { curriculumSubjects } from '@/model/curriculum-subject'
import { platformSettings } from '@/model/platform-settings'
import { rooms } from '@/model/room'
import { users } from '@/model/user'

export default async function AdminSettingsPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')

  await connectDb()
  const [settings, facultyCount, roomCount, subjectCount, schedulePolicy] = await Promise.all([
    platformSettings.findOne({ key: 'global' }).select('academicTerm academicYear').lean(),
    users.countDocuments({ role: 'user' }),
    rooms.countDocuments(),
    curriculumSubjects.countDocuments(),
    getSchedulePolicy(),
  ])
  const initialSettings = {
    academicTerm: settings?.academicTerm ?? 'First Semester' as const,
    academicYear: settings?.academicYear ?? 2026,
    ...schedulePolicy,
  }

  return (
    <main className="min-h-screen bg-[#f7f5f4] text-[#29282b]">
      <header className="sticky top-0 z-30 h-[60px] border-b border-white/10 bg-[#5d1a25]/95 text-white shadow-sm backdrop-blur-md">
        <div className="flex h-full w-full items-center justify-between px-5 sm:px-8">
          <a href="/adminDashboard" className="flex items-center gap-3" aria-label="Chronyx admin dashboard">
            <img src="/chronyx.png" alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-base font-bold tracking-tight">Chronyx</span>
          </a>
          <AccountMenu name={user.name} email={user.email} accountType="Administrator" />
        </div>
      </header>

      <AdminNavigation currentPage="settings" />

      <div className="mx-auto w-full max-w-[1480px] px-5 py-6 sm:px-8 sm:py-10 lg:pl-72 lg:pr-8">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d4a57]">Workspace administration</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#261d1f] sm:text-4xl">Settings</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#75656a]">
            Configure the active academic period and review the resources and safeguards behind your schedule.
          </p>
        </div>
        <SettingsManager
          initialSettings={initialSettings}
          setupStatus={{ facultyCount, roomCount, subjectCount }}
        />
      </div>
    </main>
  )
}
