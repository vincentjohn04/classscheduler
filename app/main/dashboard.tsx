/* eslint-disable @next/next/no-img-element */
import AccountMenu from '@/app/components/account-menu'

type DashboardProps = {
  name: string
  email: string
  subjectCount: number
  facultyMembers: Array<{ id: string; name: string }>
}

function NavIcon({ type }: { type: 'dashboard' | 'schedule' | 'subjects' | 'settings' }) {
  if (type === 'dashboard') {
    return <img src="/svg/dashboard_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'schedule') {
    return <img src="/svg/schedule_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'subjects') {
    return <img src="/svg/subject_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Dashboard({ name, email, subjectCount, facultyMembers }: DashboardProps) {
  return (
    <main
      aria-label={`Dashboard for ${name}`}
      className="min-h-screen bg-[#f7f5f4] text-[#29282b]"
    >
      <header className="sticky top-0 z-30 h-[60px] border-b border-white/10 bg-[#5d1a25]/95 text-white shadow-sm backdrop-blur-md">
        <div className="flex h-full w-full items-center justify-between px-5 sm:px-8">
          <a href="/dashboard" className="flex items-center gap-3" aria-label="Chronyx homepage">
            <img
              src="/chronyx.png"
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="text-base font-bold tracking-tight">Chronyx</span>
          </a>
          <AccountMenu name={name} email={email} />
        </div>
      </header>

      <nav
        aria-label="Dashboard navigation"
        className="flex flex-wrap items-center justify-center gap-1 bg-[#5d1a25] px-2 py-2 text-white shadow-md sm:gap-3 lg:fixed lg:left-5 lg:top-1/2 lg:z-20 lg:w-56 lg:-translate-y-1/2 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-1.5 lg:rounded-2xl lg:border lg:border-white/15 lg:bg-[#5d1a25]/95 lg:px-2.5 lg:py-3 lg:shadow-[0_12px_30px_rgba(54,24,28,0.28)] lg:backdrop-blur-md"
      >
        {[
          { label: 'Dashboard', type: 'dashboard' as const, href: '#overview', active: true },
          { label: 'Schedule', type: 'schedule' as const, href: '/schedule', active: false },
          { label: 'Curriculum Subjects', type: 'subjects' as const, href: '/subjects', active: false },
          { label: 'Settings', type: 'settings' as const, href: '/settings', active: false },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 hover:bg-white/15 lg:justify-start ${
              item.active ? 'bg-[#e43a3d] text-white' : 'text-white/90'
            }`}
          >
            <NavIcon type={item.type} />
            <span className="whitespace-nowrap">{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="mx-auto w-full max-w-[1180px] px-5 py-6 sm:px-8 sm:py-10 lg:pl-72 lg:pr-8">
        <div
          id="overview"
          className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#171719]">
              Dashboard Overview
            </h1>
            <p className="mt-1 text-sm text-[#9a6e75]">First Semester 2026</p>
          </div>
          <button
            type="button"
            className="inline-flex w-fit items-center gap-2 rounded-md bg-[#5d1a25] px-3.5 py-2.5 text-xs font-medium text-white shadow-[0_3px_7px_rgba(54,24,28,0.28)] transition hover:bg-[#762331] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d1a25]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M20 7v5h-5M4 17v-5h5m10.2-2A7 7 0 0 0 7.3 6.2L5 8m14 8-2.3 1.8A7 7 0 0 1 4.8 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Auto-Generate Schedule
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="min-h-[152px] rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-[#85545d]">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path
                    d="M10 1.8 17.5 5v4.4c0 4.2-3.2 7.2-7.5 8.8C5.7 16.6 2.5 13.6 2.5 9.4V5L10 1.8Z"
                    fill="#8b94aa"
                  />
                  <path d="m7.2 9.8 1.8 1.8 3.8-4" stroke="white" strokeWidth="1.5" />
                </svg>
                Conflict Status
              </h2>
              <span className="rounded-full bg-[#a8d1ff] px-2 py-0.5 text-[10px] font-medium text-[#315d89]">
                Live
              </span>
            </div>
            <p className="mt-3 max-w-[235px] text-[11px] leading-[1.45] text-[#9b737a]">
              Current algorithm run detected zero overlapping constraints for assigned faculty and rooms.
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-[38px] font-semibold leading-none text-[#895c64]">0</span>
              <span className="text-sm text-[#9a6e75]">Conflicts</span>
            </div>
          </article>

          <article
            id="subjects"
            className="min-h-[152px] rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#85545d]">Subjects</h2>
              <span aria-hidden="true" className="text-lg leading-none text-[#85545d]">≡</span>
            </div>
            <p className="mt-3 text-[32px] font-semibold leading-none text-[#895c64]">{subjectCount}</p>
            <p className="mt-4 max-w-[190px] text-[11px] leading-[1.45] text-[#9b737a]">
              Core Curriculum Subjects currently managed
            </p>
            <a href="/subjects" className="mt-3 inline-block text-[10px] font-medium text-[#5d1a25] hover:underline">
              Browse curriculum
            </a>
          </article>

          <article id="rooms" className="min-h-[152px] rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)] md:col-span-2 xl:col-span-1">
            <h2 className="text-sm font-medium text-[#85545d]">Room Utilization</h2>
            <p className="mt-3 text-[11px] leading-relaxed text-[#8b777b]">
              Your assigned room is shown with each class on your schedule.
            </p>
            <a href="/schedule" className="mt-3 inline-block text-[10px] font-medium text-[#5d1a25] hover:underline">
              View my schedule
            </a>
          </article>

          <section
            id="upcoming-classes"
            aria-labelledby="upcoming-title"
            className="overflow-hidden rounded-lg bg-white shadow-[0_2px_5px_rgba(31,41,55,0.16)] md:col-span-2"
          >
            <div className="flex items-center justify-between bg-[#5d1a25] px-3 py-1.5 text-white">
              <h2 id="upcoming-title" className="text-base font-semibold leading-tight">
                Upcoming Classes
              </h2>
              <a href="#upcoming-classes" className="text-[10px] text-white/80 hover:text-white">
                View Full Schedule
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[10px]">
                <thead>
                  <tr className="border-b border-[#d2d2d2] text-[#414141]">
                    <th scope="col" className="px-3 py-2 font-medium">Time</th>
                    <th scope="col" className="px-3 py-2 font-medium">Course</th>
                    <th scope="col" className="px-3 py-2 font-medium">Professor/Instructor</th>
                    <th scope="col" className="px-3 py-2 font-medium">Room</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="h-56 px-3 py-6 text-center align-top text-xs text-[#8b777b]">
                      No upcoming classes scheduled.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 md:col-span-2 xl:col-span-1 xl:grid-cols-1">
            <section className="min-h-[170px] rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)]">
              <h2 className="text-sm font-medium text-[#85545d]">Professors/Instructors</h2>
              {facultyMembers.length > 0 ? (
                <ul className="mt-2 space-y-2 text-[11px]">
                  {facultyMembers.map((member) => (
                    <li key={member.id} className="flex items-start gap-1.5">
                      <span aria-hidden="true" className="text-[#5d1a25]">•</span>
                      <span>{member.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[11px] text-[#8b777b]">No user accounts found.</p>
              )}
            </section>

            <section
              className="flex min-h-[92px] items-center gap-3 rounded-lg bg-[#5d1a25] p-4 text-white shadow-[0_2px_5px_rgba(31,41,55,0.16)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#42111a]">
                <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
                  <path d="m2 11 14-6 14 6-14 6L2 11Z" fill="#e7b5bd" />
                  <path d="M7 14v7c5 4 13 4 18 0v-7l-9 4-9-4Z" fill="#e7b5bd" />
                  <path d="M29 12v8" stroke="#e7b5bd" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-medium">Faculty Availability</h2>
                <p className="mt-1.5 text-[10px] leading-[1.5] text-white/75">
                  All key professors/instructors have submitted their preferred time slots.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
