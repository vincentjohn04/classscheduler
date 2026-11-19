import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/auth'
import connectDb from '@/lib/mongodb'
import { schedules } from '@/model/schedule'
import { rooms } from '@/model/room'
import { getSchedulePolicy } from '@/lib/schedule-policy'
import Schedule from '@/app/main/schedule'
import { curriculumSubjects } from '@/model/curriculum-subject'

export default async function SchedulePage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (user.role === 'admin') redirect('/adminDashboard')

  await connectDb()
  const [records, roomRecords, curriculumRecords, schedulePolicy] = await Promise.all([
    schedules.find({
      facultyId: user.id,
      $or: [{ status: 'scheduled' }, { status: { $exists: false } }],
    }).sort({ day: 1, startTime: 1 }).lean(),
    rooms.find({}).select('name type').lean(),
    curriculumSubjects.find({}).select('name code category department').sort({ category: 1, name: 1 }).lean(),
    getSchedulePolicy(),
  ])
  const roomTypeByName = new Map(roomRecords.map((room) => [room.name, room.type ?? 'lecture']))
  const assignments = records.map((record) => ({
    id: record._id.toString(),
    facultyId: user.id,
    facultyName: user.name,
    facultyEmail: user.email,
    subject: record.subject,
    category: record.category,
    classType: record.classType ?? roomTypeByName.get(record.room ?? '') ?? 'lecture',
    room: record.room ?? '',
    day: record.day,
    startTime: record.startTime,
    endTime: record.endTime,
    durationMinutes: record.durationMinutes
      ?? (Number(record.endTime.slice(0, 2)) * 60 + Number(record.endTime.slice(3, 5)))
        - (Number(record.startTime.slice(0, 2)) * 60 + Number(record.startTime.slice(3, 5))),
  }))

  const curriculumOptions = curriculumRecords.map((record) => ({
    id: record._id.toString(),
    name: record.name,
    code: record.code,
    category: record.category || record.department || 'Uncategorized',
  }))

  return (
    <Schedule
      name={user.name}
      email={user.email}
      assignments={assignments}
      curriculumOptions={curriculumOptions}
      schedulePolicy={schedulePolicy}
    />
  )
}
