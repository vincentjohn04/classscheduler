'use client'

import { useEffect, useRef, useState } from 'react'
import { logout } from '@/app/api/server/auth/auth'

type AccountMenuProps = {
  name: string
  email: string
  accountType?: string
}

export default function AccountMenu({
  name,
  email,
  accountType = 'Faculty Member',
}: AccountMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const firstName = name.trim().split(/\s+/)[0] || name

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

  return (
    <>
      <div ref={menuRef} className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            aria-label="Open admin announcements"
            aria-haspopup="dialog"
            aria-expanded={isNotificationsOpen}
            onClick={() => {
              setIsMenuOpen(false)
              setIsNotificationsOpen((open) => !open)
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
          </button>
          {isNotificationsOpen && (
            <section
              role="dialog"
              aria-label="Admin announcements"
              className="absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#eadfe1] bg-white text-[#29282b] shadow-xl"
            >
              <div className="border-b border-[#eee6e7] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#5d1a25]">Updates & Announcements</h2>
                <p className="mt-0.5 text-[11px] text-[#8b777b]">Notices from your administrator</p>
              </div>
              <div className="px-4 py-6 text-center">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#f7ecee] text-[#8d4a57]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path
                      d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12h4"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <p className="mt-3 text-xs font-medium text-[#514a4c]">No announcements yet</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#8b777b]">
                  Admin updates and announcements will appear here.
                </p>
              </div>
            </section>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label={`Open account menu for ${name}`}
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
                <p className="truncate text-sm font-medium">{name}</p>
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

      {isAccountOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1719]/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsAccountOpen(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-dialog-title"
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="account-dialog-title" className="text-lg font-semibold text-[#5d1a25]">
                  Manage account
                </h2>
                <p className="mt-1 text-xs text-[#8b777b]">Your {accountType.toLowerCase()} account details</p>
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
            <dl className="mt-5 space-y-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9a6e75]">Name</dt>
                <dd className="mt-1 break-words text-sm text-[#29282b]">{name}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9a6e75]">Email</dt>
                <dd className="mt-1 break-words text-sm text-[#29282b]">{email}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[#9a6e75]">Account type</dt>
                <dd className="mt-1 text-sm text-[#29282b]">{accountType}</dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAccountOpen(false)}
                className="rounded-md bg-[#5d1a25] px-4 py-2 text-xs font-medium text-white hover:bg-[#762331] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d1a25]"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
