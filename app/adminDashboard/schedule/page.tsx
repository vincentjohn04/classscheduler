/* eslint-disable @next/next/no-img-element */
import AccountMenu from '@/app/components/account-menu'
import AdminNavigation from '@/app/components/admin-navigation'
import ScheduleManager from '@/app/adminDashboard/schedule/schedule-manager'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/auth'
import connectDb from '@/lib/mongodb'
import { normalizeRoomUsageType } from '@/lib/rooms'
import {
  isScheduleDay,
  scheduleDays,
  type ScheduleAssignment,
  type ScheduleClassRequest,
  type SchedulePreferenceRequest,
} from '@/lib/schedule'
import { schedules } from '@/model/schedule'
import { scheduleRequests } from '@/model/schedule-request'
import { rooms } from '@/model/room'
import { curriculumSubjects } from '@/model/curriculum-subject'
import { users } from '@/model/user'
import { getSchedulePolicy } from '@/lib/schedule-policy'

function NavigationIcon({ type }: { type: 'dashboard' | 'schedule' | 'subjects' | 'settings' }) {
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
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default async function AdminSchedulePage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')

  await connectDb()
  const [facultyRecords, scheduleRecords, requestRecords, roomRecords, curriculumRecords, schedulePolicy] = await Promise.all([
    users.find({ role: 'user' }).select('name email').sort({ name: 1 }).lean(),
    schedules.find({}).sort({ createdAt: 1 }).lean(),
    scheduleRequests.find({}).sort({ createdAt: -1 }).lean(),
    rooms.find({}).select('name type').sort({ name: 1 }).lean(),
    curriculumSubjects.find({}).select('name code units category department').sort({ category: 1, name: 1 }).lean(),
    getSchedulePolicy(),
  ])
  const facultyMembers = facultyRecords.map((member) => ({
    id: member._id.toString(),
    name: member.name,
    email: member.email,
  }))
  const facultyById = new Map(facultyMembers.map((member) => [member.id, member]))
  const roomTypeByName = new Map(roomRecords.map((room) => [room.name, room.type === 'lab' ? 'lab' : 'lecture']))
  const initialSchedules: ScheduleAssignment[] = []
  const initialPending: ScheduleClassRequest[] = []
  const initialRequests: SchedulePreferenceRequest[] = []
  for (const record of requestRecords) {
    const member = facultyById.get(record.facultyId.toString())
    if (!member) continue
    if (!isScheduleDay(record.day)) {
      throw new Error(`Schedule request ${record._id.toString()} has an invalid day.`)
    }

    initialRequests.push({
      id: record._id.toString(),
      facultyId: member.id,
      facultyName: member.name,
      facultyEmail: member.email,
      subject: record.subject,
      category: record.category ?? '',
      classType: record.classType ?? 'lecture',
      day: record.day,
      startTime: record.startTime,
      endTime: record.endTime,
      status: record.status,
      createdAt: record.createdAt?.toISOString() ?? null,
    })
  }

  for (const record of scheduleRecords) {
    const member = facultyById.get(record.facultyId.toString())
    if (!member) continue

    if (record.status === 'pending') {
      initialPending.push({
        id: record._id.toString(),
        facultyId: member.id,
        facultyName: member.name,
        facultyEmail: member.email,
        subject: record.subject,
        category: record.category ?? '',
        classType: record.classType ?? 'lecture',
        meetingPattern: record.meetingPattern ?? 'single',
        patternGroupId: record.patternGroupId ?? undefined,
        preferredDay: isScheduleDay(record.preferredDay) ? record.preferredDay : undefined,
        preferredRoom: record.preferredRoom ?? undefined,
        durationMinutes: record.durationMinutes,
      })
      continue
    }

    if (
      (record.status !== 'scheduled' && record.status !== undefined)
      || !isScheduleDay(record.day)
      || !record.startTime
      || !record.endTime
    ) {
      throw new Error(`Scheduled class ${record._id.toString()} is missing valid day or time data.`)
    }
    const [startHour, startMinute] = record.startTime.split(':').map(Number)
    const [endHour, endMinute] = record.endTime.split(':').map(Number)

    initialSchedules.push({
      id: record._id.toString(),
      facultyId: member.id,
      facultyName: member.name,
      facultyEmail: member.email,
      subject: record.subject,
      category: record.category,
      classType: record.classType ?? (record.room ? roomTypeByName.get(record.room) : undefined) ?? 'lecture',
      meetingPattern: record.meetingPattern ?? 'single',
      room: record.room ?? '',
      durationMinutes: record.durationMinutes ?? endHour * 60 + endMinute - startHour * 60 - startMinute,
      day: record.day,
      startTime: record.startTime,
      endTime: record.endTime,
    })
  }
  initialSchedules.sort((a, b) => scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day) || a.startTime.localeCompare(b.startTime))

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

      <AdminNavigation currentPage="schedule" />

      <div className="mx-auto w-full max-w-[1480px] px-5 py-6 sm:px-8 sm:py-10 lg:pl-72 lg:pr-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#171719]">
              <NavigationIcon type="schedule" />
              Faculty Schedules
            </h1>
            <p className="mt-1 text-sm text-[#9a6e75]">
              Assign weekly classes and prevent faculty and room time conflicts.
            </p>
          </div>
          <span className="w-fit rounded-full border border-[#c8d7e1] bg-white/70 px-3 py-1 text-[11px] text-[#75636a]">
            {facultyMembers.length} faculty members
          </span>
        </div>
        <ScheduleManager
          facultyMembers={facultyMembers}
          initialSchedules={initialSchedules}
          initialPending={initialPending}
          initialRequests={initialRequests}
          initialRooms={roomRecords.map((room) => ({
            id: room._id.toString(),
            name: room.name,
            type: normalizeRoomUsageType(room.type),
          }))}
          initialCurriculum={curriculumRecords.map((record) => ({
            id: record._id.toString(),
            name: record.name,
            code: record.code,
            units: record.units,
            category: record.category || record.department || 'Uncategorized',
          }))}
          schedulePolicy={schedulePolicy}
        />
      </div>
    </main>
  )
}
