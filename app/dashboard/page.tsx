import Dashboard from '@/app/main/dashboard'
import { getAuthenticatedUser } from '@/lib/auth'
import connectDb from '@/lib/mongodb'
import { curriculumSubjects } from '@/model/curriculum-subject'
import { users } from '@/model/user'
import { redirect } from 'next/navigation'

export default async function Page() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (user.role === 'admin') redirect('/adminDashboard')

  await connectDb()
  const [subjectCount, facultyMembers] = await Promise.all([
    curriculumSubjects.countDocuments(),
    users.find({ role: 'user' }).select('name').sort({ name: 1 }).lean(),
  ])

  return (
    <Dashboard
      name={user.name}
      email={user.email}
      subjectCount={subjectCount}
      facultyMembers={facultyMembers.map((member) => ({
        id: member._id.toString(),
        name: member.name,
      }))}
    />
  )
}