/* eslint-disable @next/next/no-img-element */
import AccountMenu from '@/app/components/account-menu'
import AdminNavigation from '@/app/components/admin-navigation'
import RoomManager from '@/app/adminDashboard/rooms/room-manager'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/auth'
import connectDb from '@/lib/mongodb'
import { rooms } from '@/model/room'

export default async function AdminRoomsPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')

  await connectDb()
  const roomRecords = await rooms.find({}).select('name type').sort({ name: 1 }).lean()
  const initialRooms = roomRecords.map((room) => ({
    id: room._id.toString(),
    name: room.name,
    type: room.type === 'lab' ? 'lab' as const : 'lecture' as const,
  }))

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

      <AdminNavigation currentPage="rooms" />

      <div className="mx-auto w-full max-w-[1480px] px-5 py-6 sm:px-8 sm:py-10 lg:pl-72 lg:pr-8">
        <div className="mb-5">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#171719]">Room Inventory</h1>
          <p className="mt-1 text-sm text-[#9a6e75]">Choose which rooms are allowed for scheduling.</p>
        </div>
        <RoomManager initialRooms={initialRooms} />
      </div>
    </main>
  )
}
