/* eslint-disable @next/next/no-img-element */
import AccountMenu from '@/app/components/account-menu'
import AdminNavigation from '@/app/components/admin-navigation'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/auth'
import connectDb from '@/lib/mongodb'
import { formatRoomUsageType } from '@/lib/rooms'
import { reaccessRequests } from '@/model/reaccess-request'
import { rooms } from '@/model/room'
import { schedules } from '@/model/schedule'
import { curriculumSubjects } from '@/model/curriculum-subject'
import { users } from '@/model/user'
import { platformSettings } from '@/model/platform-settings'
import LoginAccessPanel, { type LockedLoginRecord } from './login-access-panel'

function NavigationIcon({ type }: { type: 'dashboard' | 'schedule' | 'subjects' | 'rooms' | 'settings' }) {
  if (type === 'dashboard') {
    return <img src="/svg/dashboard_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'schedule') {
    return <img src="/svg/schedule_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'subjects') {
    return <img src="/svg/subject_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'rooms') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M3 21h18M5 21V5l7-2 7 2v16M9 8h1m4 0h1m-6 4h1m4 0h1m-5 9v-5h4v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default async function AdminDashboardPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')

  await connectDb()
  const [accountCount, administratorCount, recentAccounts, facultyMembers, roomRecords, scheduledClassCount, subjectCount, activeAcademicSettings, pendingReaccessDocs] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ role: 'admin' }),
    users.aggregate([
      {
        $match: {
          $expr: {
            $gte: ['$createdAt', { $dateSubtract: { startDate: '$$NOW', unit: 'day', amount: 7 } }],
          },
        },
      },
      { $count: 'total' },
    ]),
    users.find({ role: 'user' }).select('name').sort({ name: 1 }).lean(),
    rooms.find({}).select('name type').sort({ name: 1 }).lean(),
    schedules.countDocuments({ status: 'scheduled' }),
    curriculumSubjects.countDocuments(),
    platformSettings.findOne({ key: 'global' }).select('academicTerm academicYear').lean(),
    reaccessRequests
      .find({ status: 'pending' })
      .sort({ requestedAt: -1 })
      .lean(),
  ])
  const lockedEmails = pendingReaccessDocs.map((record) => record.email)
  const lockedUsers = lockedEmails.length
    ? await users.find({ email: { $in: lockedEmails } }).select('name email role').lean()
    : []
  const lockedUserMap = new Map(lockedUsers.map((account) => [account.email, account]))
  const initialLockedRecords: LockedLoginRecord[] = pendingReaccessDocs.map((record) => {
    const account = lockedUserMap.get(record.email)
    return {
      email: record.email,
      name: account?.name ?? record.userName ?? null,
      role: account?.role ?? record.userRole ?? null,
      failedAttempts: record.failedAttempts ?? 3,
      reaccessRequestedAt: record.requestedAt
        ? new Date(record.requestedAt).toISOString()
        : null,
      reaccessReason: record.reason ?? null,
      expiresAt: null,
    }
  })
  const recentAccountCount = recentAccounts[0]?.total ?? 0
  const roomCount = roomRecords.length

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

      <AdminNavigation currentPage="dashboard" />

      <div className="mx-auto w-full max-w-[1480px] px-5 py-6 sm:px-8 sm:py-10 lg:pl-72 lg:pr-8">
        <div id="overview" className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#171719]">
              Dashboard Overview
            </h1>
            <p className="mt-1 text-sm text-[#9a6e75]">
              {activeAcademicSettings?.academicTerm ?? 'First Semester'} {activeAcademicSettings?.academicYear ?? 2026}
            </p>
          </div>
          <a
            href="/adminDashboard/schedule"
            title="Generate or edit the faculty schedule"
            className="inline-flex w-fit items-center gap-2 rounded-md bg-[#5d1a25] px-3.5 py-2.5 text-xs font-medium text-white shadow-[0_3px_7px_rgba(54,24,28,0.28)] hover:bg-[#43121a]"
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
            Generate Schedule
          </a>
        </div>

        <LoginAccessPanel initialRecords={initialLockedRecords} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="min-h-[152px] rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium text-[#85545d]">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M10 1.8 17.5 5v4.4c0 4.2-3.2 7.2-7.5 8.8C5.7 16.6 2.5 13.6 2.5 9.4V5L10 1.8Z" fill="#8b94aa" />
                  <path d="m7.2 9.8 1.8 1.8 3.8-4" stroke="white" strokeWidth="1.5" />
                </svg>
                Conflict Status
              </h2>
              <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-medium text-[#28713b]">
                Protected
              </span>
            </div>
            <p className="mt-3 max-w-[235px] text-[11px] leading-[1.45] text-[#9b737a]">
              Overlapping classes are blocked when faculty schedules are assigned.
            </p>
            <p className="mt-3 text-[32px] font-semibold leading-none text-[#28713b]">0</p>
          </article>

          <article id="subjects" className="min-h-[152px] rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#85545d]">Curriculum Subjects</h2>
              <span aria-hidden="true" className="text-lg leading-none text-[#85545d]">≡</span>
            </div>
            <p className="mt-3 text-[32px] font-semibold leading-none text-[#895c64]">{subjectCount}</p>
            <p className="mt-4 max-w-[220px] text-[11px] leading-[1.45] text-[#9b737a]">
              Browse subjects arranged by academic department.
            </p>
            <a href="/subjects" className="mt-3 inline-block text-[10px] font-medium text-[#5d1a25] hover:underline">
              Browse curriculum
            </a>
          </article>

          <section id="rooms" aria-labelledby="rooms-title" className="min-h-[152px] rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)] md:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between gap-3">
              <h2 id="rooms-title" className="flex items-center gap-2 text-sm font-medium text-[#85545d]">
                <NavigationIcon type="rooms" />
                Allowed Rooms
              </h2>
              <span className="rounded-full bg-[#f7ecee] px-2 py-0.5 text-[10px] font-medium text-[#5d1a25]">
                {roomCount}
              </span>
            </div>
            {roomRecords.length ? (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Rooms available for scheduling">
                {roomRecords.map((room) => (
                  <li key={room._id.toString()} className="rounded-full border border-[#eadde0] bg-[#fbf7f8] px-3 py-1 text-[10px] text-[#514a4c]">
                    {room.name} · {formatRoomUsageType(room.type).toLocaleUpperCase()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] leading-relaxed text-[#8b777b]">
                No rooms are allowed yet. Add rooms in schedule management.
              </p>
            )}
            <a href="/adminDashboard/rooms" className="mt-3 inline-block text-[10px] font-medium text-[#5d1a25] hover:underline">
              Manage rooms
            </a>
            <div className="mt-3 border-t border-[#d6d6d6] pt-1.5 text-right text-[9px] text-[#777]">
              {scheduledClassCount} scheduled class{scheduledClassCount === 1 ? '' : 'es'} assigned a room · {accountCount} accounts · {administratorCount} administrators
            </div>
          </section>

          <section
            id="upcoming-classes"
            aria-labelledby="upcoming-title"
            className="overflow-hidden rounded-lg bg-white shadow-[0_2px_5px_rgba(31,41,55,0.16)] md:col-span-2"
          >
            <div className="flex items-center justify-between bg-[#5d1a25] px-3 py-1.5 text-white">
              <h2 id="upcoming-title" className="text-base font-semibold leading-tight">Upcoming Classes</h2>
              <a href="/adminDashboard/schedule" className="text-[10px] text-white/80 hover:text-white">
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
                      No classes to display. Generate a schedule after adding curriculum, rooms, and availability.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 md:col-span-2 xl:col-span-1 xl:grid-cols-1">
            <section className="min-h-[170px] rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-[#85545d]">Professors/Instructors</h2>
              </div>
              {facultyMembers.length > 0 ? (
                <ul className="mt-2 space-y-2 text-[11px]">
                  {facultyMembers.map((member) => (
                    <li key={member._id.toString()} className="flex items-start gap-1.5">
                      <span aria-hidden="true" className="text-[#5d1a25]">•</span>
                      <span>{member.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[11px] text-[#8b777b]">No user accounts found.</p>
              )}
            </section>

            <a href="/adminDashboard/settings" className="flex min-h-[92px] items-center gap-3 rounded-lg bg-[#5d1a25] p-4 text-white shadow-[0_2px_5px_rgba(31,41,55,0.16)] transition hover:bg-[#48131c]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#42111a]">
                <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
                  <path d="m2 11 14-6 14 6-14 6L2 11Z" fill="#e7b5bd" />
                  <path d="M7 14v7c5 4 13 4 18 0v-7l-9 4-9-4Z" fill="#e7b5bd" />
                  <path d="M29 12v8" stroke="#e7b5bd" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-medium">Workspace Settings</h2>
                <p className="mt-1.5 text-[10px] leading-[1.5] text-white/75">
                  Set the academic period and review scheduling setup.
                </p>
              </div>
            </a>
          </div>
        </div>

        <p className="mt-4 text-right text-[10px] text-[#8b777b]">
          {recentAccountCount} accounts added in the last 7 days
        </p>
      </div>
    </main>
  )
}
