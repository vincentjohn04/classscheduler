import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/auth'
import Subjects from '@/app/main/subjects'

export default async function SubjectsPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')

  return <Subjects name={user.name} email={user.email} isAdmin={user.role === 'admin'} />
}
