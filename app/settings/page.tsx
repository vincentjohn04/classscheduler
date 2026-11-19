/* eslint-disable @next/next/no-img-element */
import { redirect } from 'next/navigation'
import AccountMenu from '@/app/components/account-menu'
import { getAuthenticatedUser } from '@/lib/auth'
import connectDb from '@/lib/mongodb'
import { getSchedulePolicy } from '@/lib/schedule-policy'
import { platformSettings } from '@/model/platform-settings'

export default async function SettingsPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (user.role === 'admin') redirect('/adminDashboard/settings')

  await connectDb()
  const [settings, schedulePolicy] = await Promise.all([
    platformSettings.findOne({ key: 'global' }).select('academicTerm academicYear').lean(),
    getSchedulePolicy(),
  ])
  const academicTerm = settings?.academicTerm ?? 'First Semester'
  const academicYear = settings?.academicYear ?? 2026

  return (
    <main className="min-h-screen bg-[#f7f5f4] text-[#29282b]">
      <header className="sticky top-0 z-30 h-[60px] border-b border-white/10 bg-[#5d1a25]/95 text-white shadow-sm backdrop-blur-md">
        <div className="flex h-full w-full items-center justify-between px-5 sm:px-8">
          <a href="/dashboard" className="flex items-center gap-3" aria-label="Chronyx dashboard">
            <img src="/chronyx.png" alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-base font-bold tracking-tight">Chronyx</span>
          </a>
          <AccountMenu name={user.name} email={user.email} />
        </div>
      </header>

      <nav
        aria-label="Dashboard navigation"
        className="flex flex-wrap items-center justify-center gap-1 bg-[#5d1a25] px-2 py-2 text-white shadow-md sm:gap-3 lg:fixed lg:left-5 lg:top-1/2 lg:z-20 lg:w-56 lg:-translate-y-1/2 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-1.5 lg:rounded-2xl lg:border lg:border-white/15 lg:bg-[#5d1a25]/95 lg:px-2.5 lg:py-3 lg:shadow-[0_12px_30px_rgba(54,24,28,0.28)] lg:backdrop-blur-md"
      >
        {[
          { label: 'Dashboard', href: '/dashboard', icon: '/svg/dashboard_svgrepo.com.svg' },
          { label: 'My Schedule', href: '/schedule', icon: '/svg/schedule_svgrepo.com.svg' },
          { label: 'Curriculum Subjects', href: '/subjects', icon: '/svg/subject_svgrepo.com.svg' },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/90 transition hover:bg-white/15 lg:justify-start"
          >
            <img src={item.icon} alt="" className="h-5 w-5" />
            <span className="whitespace-nowrap">{item.label}</span>
          </a>
        ))}
        <a
          href="/settings"
          aria-current="page"
          className="flex shrink-0 items-center gap-3 rounded-xl bg-[#e43a3d] px-3 py-2.5 text-sm text-white lg:justify-start"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="2" />
            <path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l-.1-.1a1.8 1.8 0 1 1 2.5 2.5l.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" fill="currentColor" />
          </svg>
          <span className="whitespace-nowrap">Settings</span>
        </a>
      </nav>

      <div className="mx-auto w-full max-w-[1180px] px-5 py-6 sm:px-8 sm:py-10 lg:pl-72 lg:pr-8">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d4a57]">Workspace information</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#261d1f] sm:text-4xl">Settings</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#75656a]">
            Current academic period and scheduling rules for the Chronyx workspace.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section aria-labelledby="academic-period-title" className="rounded-2xl border border-[#eadde0] bg-white p-5 shadow-sm sm:p-6">
            <h2 id="academic-period-title" className="text-base font-semibold text-[#302326]">Academic period</h2>
            <p className="mt-2 text-2xl font-semibold text-[#5d1a25]">{academicTerm} {academicYear}</p>
            <p className="mt-2 text-sm text-[#796a6e]">Set and maintained by your workspace administrator.</p>
          </section>

          <section aria-labelledby="teaching-hours-title" className="rounded-2xl border border-[#eadde0] bg-white p-5 shadow-sm sm:p-6">
            <h2 id="teaching-hours-title" className="text-base font-semibold text-[#302326]">Teaching hours</h2>
            <p className="mt-2 text-2xl font-semibold text-[#5d1a25]">
              {schedulePolicy.dayStartTime}–{schedulePolicy.dayEndTime}
            </p>
            <p className="mt-2 text-sm text-[#796a6e]">Classes and preferred schedule requests must fit within these hours.</p>
          </section>

          <section aria-labelledby="teaching-days-title" className="rounded-2xl border border-[#eadde0] bg-white p-5 shadow-sm sm:p-6">
            <h2 id="teaching-days-title" className="text-base font-semibold text-[#302326]">Teaching days</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {schedulePolicy.teachingDays.map((day) => (
                <li key={day} className="rounded-full bg-[#f8eff1] px-3 py-1.5 text-sm font-medium text-[#6e303b]">{day}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="schedule-protections-title" className="rounded-2xl border border-[#eadde0] bg-white p-5 shadow-sm sm:p-6">
            <h2 id="schedule-protections-title" className="text-base font-semibold text-[#302326]">Schedule protections</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#5b4b50]">
              <li>Faculty and room time conflicts are prevented.</li>
              <li>Rooms are matched to the class type.</li>
              <li>Schedule requests are reviewed by the administrator.</li>
            </ul>
          </section>
        </div>
        <p className="mt-5 text-xs text-[#8b777b]">
          Workspace settings are managed by your administrator. Contact them if a setting needs to be changed.
        </p>
      </div>
    </main>
  )
}
