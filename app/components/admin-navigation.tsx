/* eslint-disable @next/next/no-img-element */
import AdminReaccessNotifier from '@/app/components/admin-reaccess-notifier'

type AdminNavigationProps = {
  currentPage: 'dashboard' | 'schedule' | 'subjects' | 'rooms' | 'settings'
}

type NavigationItem = {
  label: string
  type: 'dashboard' | 'schedule' | 'subjects' | 'rooms' | 'settings'
  href: string
  active: boolean
}

function NavigationIcon({ type }: { type: NavigationItem['type'] }) {
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
        <path
          d="M3 21h18M5 21V5l7-2 7 2v16M9 8h1m4 0h1m-6 4h1m4 0h1m-5 9v-5h4v5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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

export default function AdminNavigation({ currentPage }: AdminNavigationProps) {
  const items: NavigationItem[] = [
    { label: 'Dashboard', type: 'dashboard', href: '/adminDashboard', active: currentPage === 'dashboard' },
    { label: 'Schedule', type: 'schedule', href: '/adminDashboard/schedule', active: currentPage === 'schedule' },
    { label: 'Curriculum Subjects', type: 'subjects', href: '/subjects', active: currentPage === 'subjects' },
    { label: 'Rooms', type: 'rooms', href: '/adminDashboard/rooms', active: currentPage === 'rooms' },
    { label: 'Settings', type: 'settings', href: '/adminDashboard/settings', active: currentPage === 'settings' },
  ]

  return (
    <nav
      aria-label="Admin navigation"
      className="flex flex-wrap items-center justify-center gap-1 bg-[#5d1a25] px-2 py-2 text-white shadow-md sm:gap-3 lg:fixed lg:left-5 lg:top-[100px] lg:z-20 lg:w-56 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-1.5 lg:rounded-2xl lg:border lg:border-white/15 lg:bg-[#5d1a25]/95 lg:px-2.5 lg:py-3 lg:shadow-[0_12px_30px_rgba(54,24,28,0.28)] lg:backdrop-blur-md"
    >
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 hover:bg-white/15 lg:justify-start ${
            item.active ? 'bg-[#e43a3d] text-white' : 'text-white/90'
          }`}
        >
          <NavigationIcon type={item.type} />
          <span className="whitespace-nowrap">{item.label}</span>
        </a>
      ))}
      <AdminReaccessNotifier variant="floating" />
    </nav>
  )
}
