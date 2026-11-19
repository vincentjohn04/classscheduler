'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LockedLoginRecord } from '@/app/adminDashboard/login-access-panel'

const REACCESS_UPDATED_EVENT = 'chronyx:reaccess-updated'

export default function AdminReaccessNotifier({
  variant = 'bell',
}: {
  variant?: 'bell' | 'floating'
}) {
  const [records, setRecords] = useState<LockedLoginRecord[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [approvingEmail, setApprovingEmail] = useState<string | null>(null)
  const [toastRequest, setToastRequest] = useState<LockedLoginRecord | null>(null)
  const [feedback, setFeedback] = useState('')
  const seenEmailsRef = useRef<Set<string>>(new Set())
  const hasLoadedOnceRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/login-access', { cache: 'no-store' })
      if (!response.ok) return
      const result = (await response.json()) as { data?: LockedLoginRecord[] }
      const next = result.data ?? []
      setRecords(next)

      const newlyArrived = next.find((item) => !seenEmailsRef.current.has(item.email))
      if (newlyArrived) {
        setToastRequest(newlyArrived)
      }
      seenEmailsRef.current = new Set(next.map((item) => item.email))
      hasLoadedOnceRef.current = true
    } catch {
      // Ignore transient network errors during background polling
    }
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void fetchPending()
    }, 0)
    const interval = window.setInterval(() => {
      void fetchPending()
    }, 10000)

    const onFocus = () => void fetchPending()
    const onUpdated = () => void fetchPending()

    window.addEventListener('focus', onFocus)
    window.addEventListener(REACCESS_UPDATED_EVENT, onUpdated)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(REACCESS_UPDATED_EVENT, onUpdated)
    }
  }, [fetchPending])

  useEffect(() => {
    if (!isOpen) return
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  async function approve(email: string) {
    setApprovingEmail(email)
    setFeedback('')
    try {
      const response = await fetch('/api/admin/login-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) {
        setFeedback(result.message || 'Could not approve re-access.')
        return
      }
      setRecords((prev) => prev.filter((item) => item.email !== email))
      seenEmailsRef.current.delete(email)
      setToastRequest((prev) => (prev?.email === email ? null : prev))
      setFeedback(result.message || `Approved re-access for ${email}.`)
      window.dispatchEvent(new Event(REACCESS_UPDATED_EVENT))
    } finally {
      setApprovingEmail(null)
    }
  }

  const count = records.length

  const toastBanner =
    toastRequest && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="alert"
            className="form-panel-enter fixed bottom-5 right-5 z-[100] w-[min(360px,calc(100vw-2rem))] rounded-xl border border-[#e5cfd3] bg-white p-4 text-[#292326] shadow-[0_18px_45px_rgba(54,24,28,0.22)]"
          >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fce9ec] text-[#8c1d32]">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path
                d="M10 3a5 5 0 0 0-5 5v2.6L3.6 13a1 1 0 0 0 .85 1.5h11.1a1 1 0 0 0 .85-1.5L15 10.6V8a5 5 0 0 0-5-5Zm-1.8 13a2 2 0 0 0 3.6 0"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <p className="text-xs font-bold text-[#5d1a25]">Re-access Approval Needed</p>
            <p className="mt-0.5 text-xs text-[#4b3e42]">
              <span className="font-semibold">
                {toastRequest.name ? `${toastRequest.name} (${toastRequest.email})` : toastRequest.email}
              </span>{' '}
              is locked out and requested login re-access.
            </p>
            {toastRequest.reaccessReason && (
              <p className="mt-1 text-[11px] italic text-[#6d5c60]">
                &ldquo;{toastRequest.reaccessReason}&rdquo;
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setToastRequest(null)}
          aria-label="Dismiss notification"
          className="rounded p-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void approve(toastRequest.email)}
          disabled={approvingEmail === toastRequest.email}
          className="rounded-md bg-[#5d1a25] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#43121a] disabled:opacity-60"
        >
          {approvingEmail === toastRequest.email ? 'Approving...' : 'Approve Re-access'}
        </button>
        <a
          href="/adminDashboard#login-access"
          onClick={() => setToastRequest(null)}
          className="rounded-md border border-[#e5d8db] px-3 py-1.5 text-xs font-medium text-[#5d1a25] hover:bg-[#fbf5f6]"
        >
          View all ({count})
        </a>
      </div>
    </div>,
          document.body,
        )
      : null

  if (variant === 'floating') {
    return (
      <>
        {count > 0 && (
          <a
            href="/adminDashboard#login-access"
            className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-amber-300/40 bg-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/30"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
              Re-access requests
            </span>
            <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-[#4a121b]">
              {count}
            </span>
          </a>
        )}
        {toastBanner}
      </>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev)
          void fetchPending()
        }}
        aria-label={
          count > 0
            ? `${count} pending login re-access request${count === 1 ? '' : 's'}`
            : 'Login re-access notifications'
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5">
          <path
            d="M10 3a5 5 0 0 0-5 5v2.6L3.6 13a1 1 0 0 0 .85 1.5h11.1a1 1 0 0 0 .85-1.5L15 10.6V8a5 5 0 0 0-5-5Zm-1.8 13a2 2 0 0 0 3.6 0"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e43a3d] px-1 text-[10px] font-bold text-white shadow">
            {count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="form-panel-enter absolute right-0 top-11 z-50 w-80 rounded-xl border border-[#e5cfd3] bg-white p-3.5 text-[#292326] shadow-[0_18px_45px_rgba(54,24,28,0.22)]">
          <div className="flex items-center justify-between border-b border-[#efe6e8] pb-2">
            <p className="text-xs font-bold text-[#5d1a25]">Re-access Notifications</p>
            <span className="rounded-full bg-[#f7ecee] px-2 py-0.5 text-[10px] font-semibold text-[#5d1a25]">
              {count} pending
            </span>
          </div>

          {feedback && (
            <p role="status" className="mt-2 rounded bg-green-50 px-2.5 py-1.5 text-[11px] text-green-800">
              {feedback}
            </p>
          )}

          {records.length > 0 ? (
            <ul className="mt-2 max-h-72 divide-y divide-[#efe6e8] overflow-y-auto">
              {records.map((record) => (
                <li key={record.email} className="py-2.5">
                  <p className="text-xs font-semibold text-[#292326]">
                    {record.name ? `${record.name} (${record.email})` : record.email}
                  </p>
                  {record.reaccessReason && (
                    <p className="mt-0.5 text-[11px] italic text-[#6d5c60]">
                      &ldquo;{record.reaccessReason}&rdquo;
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#8b777b]">
                      {record.failedAttempts} failed attempts
                    </span>
                    <button
                      type="button"
                      onClick={() => void approve(record.email)}
                      disabled={approvingEmail === record.email}
                      className="rounded-md bg-[#5d1a25] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#43121a] disabled:opacity-60"
                    >
                      {approvingEmail === record.email ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-xs text-[#8b777b]">
              No pending user re-access requests.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
