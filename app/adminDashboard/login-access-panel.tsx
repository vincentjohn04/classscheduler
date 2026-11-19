'use client'

import { useCallback, useEffect, useState } from 'react'

export type LockedLoginRecord = {
  email: string
  name: string | null
  role: string | null
  failedAttempts: number
  reaccessRequestedAt: string | null
  reaccessReason: string | null
  expiresAt: string | null
}

export default function LoginAccessPanel({
  initialRecords,
}: {
  initialRecords: LockedLoginRecord[]
}) {
  const [records, setRecords] = useState<LockedLoginRecord[]>(initialRecords)
  const [approvingEmail, setApprovingEmail] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const refreshRecords = useCallback(async (silent = false) => {
    if (!silent) {
      setIsRefreshing(true)
      setError('')
    }
    try {
      const response = await fetch('/api/admin/login-access', { cache: 'no-store' })
      const result = (await response.json()) as { data?: LockedLoginRecord[]; message?: string }
      if (!response.ok) throw new Error(result.message || 'Unable to refresh login access requests.')
      setRecords(result.data ?? [])
    } catch (refreshError) {
      if (!silent) {
        setError(
          refreshError instanceof Error ? refreshError.message : 'Unable to refresh login access requests.',
        )
      }
    } finally {
      if (!silent) {
        setIsRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    const handleRefresh = () => {
      void refreshRecords(true)
    }
    const interval = window.setInterval(handleRefresh, 10000)
    window.addEventListener('focus', handleRefresh)
    window.addEventListener('chronyx:reaccess-updated', handleRefresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener('chronyx:reaccess-updated', handleRefresh)
    }
  }, [refreshRecords])

  async function approveReaccess(email: string) {
    setApprovingEmail(email)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/login-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(result.message || 'Unable to approve re-access.')
      setRecords((prev) => prev.filter((item) => item.email !== email))
      setNotice(result.message || `Re-access approved for ${email}.`)
      window.dispatchEvent(new Event('chronyx:reaccess-updated'))
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Unable to approve re-access.')
    } finally {
      setApprovingEmail(null)
    }
  }

  const pendingRequestCount = records.length

  return (
    <section
      id="login-access"
      aria-labelledby="login-access-title"
      className={`mb-5 rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)] ${
        pendingRequestCount > 0 ? 'border-l-4 border-[#e43a3d]' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="login-access-title" className="text-sm font-medium text-[#85545d]">
            Login Verification &amp; Re-access Approvals
          </h2>
          {pendingRequestCount > 0 && (
            <span className="rounded-full bg-[#fce9ec] px-2 py-0.5 text-[10px] font-semibold text-[#8c1d32]">
              {pendingRequestCount} pending request{pendingRequestCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refreshRecords(false)}
          disabled={isRefreshing}
          className="rounded-md border border-[#e5d8db] px-2.5 py-1 text-[11px] font-medium text-[#5d1a25] hover:bg-[#fbf5f6] disabled:opacity-60"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      {records.length > 0 ? (
        <ul className="mt-3 divide-y divide-[#efe6e8]">
          {records.map((record) => (
            <li
              key={record.email}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[#29282b]">
                    {record.name ? `${record.name} (${record.email})` : record.email}
                  </span>
                  <span className="rounded-full bg-[#fce9ec] px-2 py-0.5 text-[10px] font-medium text-[#8c1d32]">
                    Locked · User requested re-access
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#8b777b]">
                  {record.failedAttempts} failed attempt{record.failedAttempts === 1 ? '' : 's'}
                  {record.role ? ` · ${record.role === 'admin' ? 'Administrator' : 'Faculty'}` : ''}
                </p>
                {record.reaccessReason && (
                  <p className="mt-1 text-[11px] italic text-[#5e4d51]">
                    Note from user: &ldquo;{record.reaccessReason}&rdquo;
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => approveReaccess(record.email)}
                disabled={approvingEmail === record.email}
                className="w-fit rounded-md bg-[#5d1a25] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#43121a] disabled:opacity-60"
              >
                {approvingEmail === record.email ? 'Approving...' : 'Approve Re-access'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-[#8b777b]">
          No pending user re-access requests. Locked users must submit a re-access request from the login page to appear here.
        </p>
      )}
    </section>
  )
}
