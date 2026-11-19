'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { logout } from '@/app/api/server/auth/auth'
import AccountSettingsCard from '@/app/components/account-settings-card'

type AccountMenuProps = {
  name: string
  email: string
  accountType?: string
}

type AnnouncementItem = {
  id: string
  title: string
  message: string
  createdBy: string
  createdAt: string
}

type AdminReaccessItem = {
  email: string
  name: string | null
  failedAttempts: number
  reason: string | null
  requestedAt: string
}

type AdminScheduleRequestItem = {
  id: string
  facultyName: string
  subject: string
  classType: string
  day: string
  startTime: string
  endTime: string
  createdAt: string
}

type UserScheduleUpdateItem = {
  id: string
  subject: string
  classType: string
  day: string
  startTime: string
  endTime: string
  status: 'pending' | 'approved' | 'rejected'
  updatedAt: string
}

type UserAssignedClassItem = {
  id: string
  subject: string
  room: string
  day: string
  startTime: string
  endTime: string
  updatedAt: string
}

type NotificationsResponse =
  | {
      role: 'admin'
      reaccessRequests: AdminReaccessItem[]
      scheduleRequests: AdminScheduleRequestItem[]
      announcements: AnnouncementItem[]
    }
  | {
      role: 'user'
      announcements: AnnouncementItem[]
      scheduleUpdates: UserScheduleUpdateItem[]
      assignedClasses: UserAssignedClassItem[]
    }

const REACCESS_UPDATED_EVENT = 'chronyx:reaccess-updated'

function formatShortDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AccountMenu({
  name,
  email,
  accountType = 'Faculty Member',
}: AccountMenuProps) {
  const isAdmin = accountType.toLowerCase().includes('admin')
  const readStorageKey = `chronyx:notifications-read:${email.toLowerCase()}`

  const [nameOverride, setNameOverride] = useState<{ base: string; value: string } | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const [notificationsData, setNotificationsData] = useState<NotificationsResponse | null>(null)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [adminNotifTab, setAdminNotifTab] = useState<'alerts' | 'announcements'>('alerts')
  const [lastReadAt, setLastReadAt] = useState<number>(0)

  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false)
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null)
  const [approvingEmail, setApprovingEmail] = useState<string | null>(null)
  const [notifFeedback, setNotifFeedback] = useState('')
  const [notifError, setNotifError] = useState('')

  const menuRef = useRef<HTMLDivElement>(null)
  const activeName = nameOverride?.base === name ? nameOverride.value : name
  const firstName = activeName.trim().split(/\s+/)[0] || activeName

  const fetchNotifications = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoadingNotifications(true)
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' })
      if (!response.ok) return
      const payload = (await response.json()) as NotificationsResponse
      setNotificationsData(payload)
    } catch {
      // Ignore transient polling failures
    } finally {
      if (showSpinner) setIsLoadingNotifications(false)
    }
  }, [])

  useEffect(() => {
    const readTimer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(readStorageKey)
        if (stored) {
          const parsed = Number(stored)
          if (Number.isFinite(parsed)) setLastReadAt(parsed)
        }
      } catch {
        // Ignore storage restrictions
      }
      void fetchNotifications(false)
    }, 0)

    const interval = window.setInterval(() => {
      void fetchNotifications(false)
    }, 15000)

    const onFocus = () => void fetchNotifications(false)
    const onReaccessUpdated = () => void fetchNotifications(false)

    window.addEventListener('focus', onFocus)
    window.addEventListener(REACCESS_UPDATED_EVENT, onReaccessUpdated)

    return () => {
      window.clearTimeout(readTimer)
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(REACCESS_UPDATED_EVENT, onReaccessUpdated)
    }
  }, [fetchNotifications, readStorageKey])

  useEffect(() => {
    if (!isMenuOpen && !isAccountOpen && !isNotificationsOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
        setIsAccountOpen(false)
        setIsNotificationsOpen(false)
      }
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false)
        setIsNotificationsOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsideClick)
    }
  }, [isMenuOpen, isAccountOpen, isNotificationsOpen])

  useEffect(() => {
    if (!isAccountOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isAccountOpen])

  function markAllUserNotificationsRead() {
    const now = Date.now()
    setLastReadAt(now)
    try {
      window.localStorage.setItem(readStorageKey, String(now))
    } catch {
      // Ignore storage errors
    }
  }

  async function handleApproveReaccess(targetEmail: string) {
    setApprovingEmail(targetEmail)
    setNotifError('')
    setNotifFeedback('')
    try {
      const response = await fetch('/api/admin/login-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) {
        setNotifError(result.message || 'Unable to approve re-access.')
        return
      }
      setNotifFeedback(result.message || `Re-access approved for ${targetEmail}.`)
      window.dispatchEvent(new Event(REACCESS_UPDATED_EVENT))
      await fetchNotifications(false)
    } catch {
      setNotifError('Unable to approve re-access right now.')
    } finally {
      setApprovingEmail(null)
    }
  }

  async function handlePostAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPostingAnnouncement(true)
    setNotifError('')
    setNotifFeedback('')
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: announcementTitle,
          message: announcementMessage,
        }),
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) {
        setNotifError(result.message || 'Could not post announcement.')
        return
      }
      setAnnouncementTitle('')
      setAnnouncementMessage('')
      setNotifFeedback(result.message || 'Announcement posted.')
      await fetchNotifications(false)
    } catch {
      setNotifError('Could not post announcement right now.')
    } finally {
      setIsPostingAnnouncement(false)
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    setDeletingAnnouncementId(id)
    setNotifError('')
    setNotifFeedback('')
    try {
      const response = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) {
        setNotifError(result.message || 'Could not remove announcement.')
        return
      }
      setNotifFeedback(result.message || 'Announcement removed.')
      await fetchNotifications(false)
    } catch {
      setNotifError('Could not remove announcement right now.')
    } finally {
      setDeletingAnnouncementId(null)
    }
  }

  const badgeCount = (() => {
    if (!notificationsData) return 0
    if (notificationsData.role === 'admin') {
      return notificationsData.reaccessRequests.length + notificationsData.scheduleRequests.length
    }
    const unreadAnnouncements = notificationsData.announcements.filter(
      (item) => new Date(item.createdAt).getTime() > lastReadAt,
    ).length
    const unreadScheduleDecisions = notificationsData.scheduleUpdates.filter(
      (item) => item.status !== 'pending' && new Date(item.updatedAt).getTime() > lastReadAt,
    ).length
    return unreadAnnouncements + unreadScheduleDecisions
  })()

  const accountModal =
    isAccountOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f1719]/55 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsAccountOpen(false)
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-dialog-title"
              className="form-panel-enter max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 text-[#29282b] shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="account-dialog-title" className="text-lg font-semibold text-[#5d1a25]">
                    Manage account
                  </h2>
                  <p className="mt-1 text-xs text-[#8b777b]">
                    Update your {accountType.toLowerCase()} profile name, password, or account status
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close account details"
                  onClick={() => setIsAccountOpen(false)}
                  className="rounded-md px-2 py-1 text-xl leading-none text-[#705c60] hover:bg-[#f6eff0] focus-visible:outline-2 focus-visible:outline-[#5d1a25]"
                >
                  ×
                </button>
              </div>

              <AccountSettingsCard
                initialName={activeName}
                email={email}
                accountType={accountType}
                variant="modal"
                onNameUpdated={(nextName) => setNameOverride({ base: name, value: nextName })}
              />

              <div className="mt-5 flex justify-end border-t border-[#efe6e8] pt-3">
                <button
                  type="button"
                  onClick={() => setIsAccountOpen(false)}
                  className="rounded-md border border-[#e5d8db] px-4 py-1.5 text-xs font-medium text-[#5d1a25] hover:bg-[#fbf5f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d1a25]"
                >
                  Close
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div ref={menuRef} className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            aria-label={
              badgeCount > 0
                ? `${badgeCount} unread notification${badgeCount === 1 ? '' : 's'}`
                : isAdmin
                  ? 'Open admin notifications'
                  : 'Open updates and announcements'
            }
            aria-haspopup="dialog"
            aria-expanded={isNotificationsOpen}
            onClick={() => {
              setIsMenuOpen(false)
              setNotifFeedback('')
              setNotifError('')
              setIsNotificationsOpen((open) => {
                const next = !open
                if (next) void fetchNotifications(!notificationsData)
                return next
              })
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12h4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {badgeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#e43a3d] px-1 text-[10px] font-bold text-white shadow">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <section
              role="dialog"
              aria-label={isAdmin ? 'Admin notifications' : 'Updates and announcements'}
              className="form-panel-enter absolute right-0 top-full z-40 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#eadfe1] bg-white text-[#29282b] shadow-2xl"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[#eee6e7] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#5d1a25]">
                    {isAdmin ? 'Admin Notifications' : 'Updates & Announcements'}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-[#8b777b]">
                    {isAdmin
                      ? 'Re-access approvals, schedule requests & notices'
                      : 'Admin announcements & your schedule updates'}
                  </p>
                </div>
                {!isAdmin && badgeCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllUserNotificationsRead}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-[#5d1a25] hover:bg-[#f7ecee]"
                  >
                    Mark read
                  </button>
                )}
              </div>

              {isAdmin && (
                <div
                  role="group"
                  aria-label="Notification sections"
                  className="grid grid-cols-2 gap-1 border-b border-[#eee6e7] bg-[#faf7f7] p-1.5"
                >
                  <button
                    type="button"
                    aria-pressed={adminNotifTab === 'alerts'}
                    onClick={() => setAdminNotifTab('alerts')}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                      adminNotifTab === 'alerts'
                        ? 'bg-white text-[#5d1a25] shadow-sm'
                        : 'text-[#6e5e62] hover:text-[#29282b]'
                    }`}
                  >
                    Alerts {badgeCount > 0 ? `(${badgeCount})` : ''}
                  </button>
                  <button
                    type="button"
                    aria-pressed={adminNotifTab === 'announcements'}
                    onClick={() => setAdminNotifTab('announcements')}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                      adminNotifTab === 'announcements'
                        ? 'bg-white text-[#5d1a25] shadow-sm'
                        : 'text-[#6e5e62] hover:text-[#29282b]'
                    }`}
                  >
                    Announcements (
                    {notificationsData?.announcements.length ?? 0})
                  </button>
                </div>
              )}

              {notifFeedback && (
                <p
                  role="status"
                  className="mx-3 mt-2.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-[11px] text-green-800"
                >
                  {notifFeedback}
                </p>
              )}
              {notifError && (
                <p
                  role="alert"
                  className="mx-3 mt-2.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700"
                >
                  {notifError}
                </p>
              )}

              <div className="max-h-[24rem] overflow-y-auto px-4 py-3">
                {isLoadingNotifications && !notificationsData ? (
                  <div className="space-y-3 py-2" aria-hidden="true">
                    <div className="skeleton-shimmer h-12 w-full rounded-md" />
                    <div className="skeleton-shimmer h-12 w-full rounded-md" />
                  </div>
                ) : notificationsData?.role === 'admin' ? (
                  adminNotifTab === 'alerts' ? (
                    <div className="space-y-4">
                      {/* Login Re-access Requests */}
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#85545d]">
                            Login Re-access Requests
                          </h3>
                          <span className="text-[10px] font-semibold text-[#8b777b]">
                            {notificationsData.reaccessRequests.length}
                          </span>
                        </div>
                        {notificationsData.reaccessRequests.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {notificationsData.reaccessRequests.map((req) => (
                              <li
                                key={req.email}
                                className="rounded-lg border border-[#f0d8dc] bg-[#fdf8f9] p-2.5"
                              >
                                <p className="text-xs font-semibold text-[#29282b]">
                                  {req.name ? `${req.name} (${req.email})` : req.email}
                                </p>
                                {req.reason && (
                                  <p className="mt-0.5 text-[11px] italic text-[#6d5c60]">
                                    &ldquo;{req.reason}&rdquo;
                                  </p>
                                )}
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <span className="text-[10px] text-[#8b777b]">
                                    {req.failedAttempts} failed attempts · {formatShortDate(req.requestedAt)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleApproveReaccess(req.email)}
                                    disabled={approvingEmail === req.email}
                                    className="rounded-md bg-[#5d1a25] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#43121a] disabled:opacity-60"
                                  >
                                    {approvingEmail === req.email ? 'Approving…' : 'Approve'}
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1.5 text-xs text-[#8b777b]">
                            No pending login re-access requests.
                          </p>
                        )}
                      </div>

                      {/* Pending Faculty Schedule Requests */}
                      <div className="border-t border-[#efe6e8] pt-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#85545d]">
                            Faculty Schedule Requests
                          </h3>
                          <span className="text-[10px] font-semibold text-[#8b777b]">
                            {notificationsData.scheduleRequests.length}
                          </span>
                        </div>
                        {notificationsData.scheduleRequests.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {notificationsData.scheduleRequests.map((req) => (
                              <li
                                key={req.id}
                                className="rounded-lg border border-[#eee6e7] bg-[#faf7f7] p-2.5"
                              >
                                <p className="text-xs font-semibold text-[#29282b]">
                                  {req.subject} · {req.classType}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[#6d5c60]">
                                  {req.facultyName} · {req.day} {req.startTime}–{req.endTime}
                                </p>
                                <a
                                  href="/adminDashboard/schedule"
                                  onClick={() => setIsNotificationsOpen(false)}
                                  className="mt-1.5 inline-block text-[11px] font-semibold text-[#5d1a25] hover:underline"
                                >
                                  Review in Schedule →
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1.5 text-xs text-[#8b777b]">
                            No pending faculty schedule requests.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <form onSubmit={handlePostAnnouncement} className="space-y-2 rounded-lg border border-[#eee6e7] bg-[#faf7f7] p-3">
                        <p className="text-xs font-semibold text-[#5d1a25]">
                          Post announcement to users
                        </p>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={100}
                          value={announcementTitle}
                          onChange={(event) => setAnnouncementTitle(event.target.value)}
                          disabled={isPostingAnnouncement}
                          placeholder="Announcement title"
                          className="w-full rounded-md border border-[#dfd2d4] bg-white px-2.5 py-1.5 text-xs text-[#29282b] focus:border-[#5d1a25] focus:outline-none"
                        />
                        <textarea
                          required
                          minLength={2}
                          maxLength={500}
                          rows={2}
                          value={announcementMessage}
                          onChange={(event) => setAnnouncementMessage(event.target.value)}
                          disabled={isPostingAnnouncement}
                          placeholder="Write an update for faculty members..."
                          className="w-full resize-none rounded-md border border-[#dfd2d4] bg-white px-2.5 py-1.5 text-xs text-[#29282b] focus:border-[#5d1a25] focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={
                            isPostingAnnouncement ||
                            !announcementTitle.trim() ||
                            !announcementMessage.trim()
                          }
                          className="rounded-md bg-[#5d1a25] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#43121a] disabled:opacity-60"
                        >
                          {isPostingAnnouncement ? 'Posting…' : 'Post Announcement'}
                        </button>
                      </form>

                      {notificationsData.announcements.length > 0 ? (
                        <ul className="divide-y divide-[#efe6e8]">
                          {notificationsData.announcements.map((item) => (
                            <li key={item.id} className="py-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-[#29282b]">{item.title}</p>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAnnouncement(item.id)}
                                  disabled={deletingAnnouncementId === item.id}
                                  className="shrink-0 text-[10px] font-medium text-[#a52832] hover:underline disabled:opacity-50"
                                >
                                  {deletingAnnouncementId === item.id ? 'Removing…' : 'Remove'}
                                </button>
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-[#5c5053]">
                                {item.message}
                              </p>
                              <p className="mt-1 text-[10px] text-[#8b777b]">
                                {item.createdBy} · {formatShortDate(item.createdAt)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="py-2 text-center text-xs text-[#8b777b]">
                          No announcements posted yet.
                        </p>
                      )}
                    </div>
                  )
                ) : notificationsData?.role === 'user' ? (
                  <div className="space-y-4">
                    {/* Admin Announcements */}
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#85545d]">
                        Admin Announcements
                      </h3>
                      {notificationsData.announcements.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {notificationsData.announcements.map((item) => {
                            const isUnread = new Date(item.createdAt).getTime() > lastReadAt
                            return (
                              <li
                                key={item.id}
                                className={`rounded-lg border p-2.5 ${
                                  isUnread
                                    ? 'border-[#e6c4ca] bg-[#fdf6f7]'
                                    : 'border-[#eee6e7] bg-[#faf7f7]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-[#29282b]">
                                    {item.title}
                                  </p>
                                  {isUnread && (
                                    <span className="rounded-full bg-[#5d1a25] px-1.5 py-0.5 text-[9px] font-bold text-white">
                                      New
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[11px] leading-relaxed text-[#5c5053]">
                                  {item.message}
                                </p>
                                <p className="mt-1 text-[10px] text-[#8b777b]">
                                  {item.createdBy} · {formatShortDate(item.createdAt)}
                                </p>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-xs text-[#8b777b]">
                          No announcements from your administrator yet.
                        </p>
                      )}
                    </div>

                    {/* Schedule Request Updates */}
                    <div className="border-t border-[#efe6e8] pt-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#85545d]">
                          Your Schedule Updates
                        </h3>
                        <a
                          href="/schedule"
                          onClick={() => setIsNotificationsOpen(false)}
                          className="text-[11px] font-semibold text-[#5d1a25] hover:underline"
                        >
                          My Schedule →
                        </a>
                      </div>
                      {notificationsData.scheduleUpdates.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {notificationsData.scheduleUpdates.map((req) => (
                            <li
                              key={req.id}
                              className="rounded-lg border border-[#eee6e7] bg-[#faf7f7] p-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-[#29282b]">
                                  {req.subject} ({req.classType})
                                </p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    req.status === 'approved'
                                      ? 'bg-green-100 text-green-800'
                                      : req.status === 'rejected'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {req.status === 'approved'
                                    ? 'Approved'
                                    : req.status === 'rejected'
                                      ? 'Declined'
                                      : 'Pending'}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-[#6d5c60]">
                                {req.day} · {req.startTime}–{req.endTime}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : notificationsData.assignedClasses.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {notificationsData.assignedClasses.map((cls) => (
                            <li
                              key={cls.id}
                              className="rounded-lg border border-[#eee6e7] bg-[#faf7f7] p-2.5"
                            >
                              <p className="text-xs font-semibold text-[#29282b]">{cls.subject}</p>
                              <p className="mt-0.5 text-[11px] text-[#6d5c60]">
                                {cls.day} · {cls.startTime}–{cls.endTime}
                                {cls.room ? ` · ${cls.room}` : ''}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-xs text-[#8b777b]">
                          No schedule updates yet.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-[#8b777b]">No notifications yet.</p>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label={`Open account menu for ${activeName}`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() => {
              setIsNotificationsOpen(false)
              setIsMenuOpen((open) => !open)
            }}
            className="flex items-center gap-1 rounded-full p-1 text-sm text-white/90 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold uppercase">
              {firstName.charAt(0)}
            </span>
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-3 w-3">
              <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              aria-label="Account options"
              className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-lg border border-[#eadfe1] bg-white py-1 text-[#29282b] shadow-xl"
            >
              <div className="border-b border-[#eee6e7] px-4 py-3">
                <p className="truncate text-sm font-medium">{activeName}</p>
                <p className="truncate text-xs text-[#8b777b]">{email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false)
                  setIsAccountOpen(true)
                }}
                className="block w-full px-4 py-2.5 text-left text-sm hover:bg-[#f8f3f4] focus-visible:bg-[#f8f3f4] focus-visible:outline-none"
              >
                Manage account
              </button>
              <form action={logout}>
                <button
                  type="submit"
                  role="menuitem"
                  className="block w-full px-4 py-2.5 text-left text-sm text-[#8f2638] hover:bg-[#f8f3f4] focus-visible:bg-[#f8f3f4] focus-visible:outline-none"
                >
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {accountModal}
    </>
  )
}
