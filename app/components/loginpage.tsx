'use client'

/* eslint-disable @next/next/no-img-element */

import { useActionState, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  login,
  requestAdminReaccess,
  requestPasswordReset,
  resendLoginOtp,
  signup,
} from '@/app/api/server/auth/auth'

type AuthMode = 'login' | 'signup' | 'forgot'

type LoginPageProps = {
  initialMode?: 'login' | 'signup'
  canRegisterAdmin?: boolean
  maxAdminAccounts?: number
}

const inputBaseClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-[#292326] placeholder:text-gray-400 focus:border-[#5D1A25] focus:outline-none focus:ring-2 focus:ring-[#5D1A25]/30'

const primaryButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-md bg-[#5D1A25] px-5 py-2 text-sm font-semibold text-white hover:bg-[#762331] disabled:cursor-not-allowed disabled:opacity-60'

function FormPendingSkeleton({ mode }: { mode: AuthMode }) {
  const statusLabel =
    mode === 'signup'
      ? 'Creating account...'
      : mode === 'forgot'
        ? 'Sending password reset link...'
        : 'Logging in...'

  return (
    <div
      role="status"
      aria-live="polite"
      className="form-panel-enter absolute inset-0 z-20 flex flex-col justify-center overflow-y-auto rounded-2xl bg-white px-6 py-7 sm:px-10 md:rounded-xl md:px-12 md:py-9"
    >
      <div aria-hidden="true" className="loading-bar-track absolute inset-x-0 top-0 h-1">
        <div className="loading-bar-indicator" />
      </div>

      <div className="my-auto">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#fbf5f6] px-3 py-1 text-xs font-semibold text-[#5D1A25]">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#5D1A25]/25 border-t-[#5D1A25]"
          />
          <span>{statusLabel}</span>
        </div>

        <div aria-hidden="true">
          <div className="skeleton-shimmer h-9 w-36 rounded-md" />

        {mode === 'signup' && (
          <div className="mt-5 space-y-4">
            {[1, 2, 3].map((field) => (
              <div key={field}>
                <div className="skeleton-shimmer h-4 w-20 rounded" />
                <div className="skeleton-shimmer mt-1.5 h-10 w-full rounded-md" />
                <div className="skeleton-shimmer mt-1.5 h-3 w-40 rounded" />
              </div>
            ))}
            <div>
              <div className="skeleton-shimmer h-4 w-20 rounded" />
              <div className="skeleton-shimmer mt-1.5 h-10 w-full rounded-md" />
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <div className="skeleton-shimmer h-3 w-32 rounded" />
                <div className="skeleton-shimmer h-3 w-28 rounded" />
                <div className="skeleton-shimmer h-3 w-32 rounded" />
                <div className="skeleton-shimmer h-3 w-36 rounded" />
              </div>
            </div>
            <div>
              <div className="skeleton-shimmer h-4 w-32 rounded" />
              <div className="skeleton-shimmer mt-1.5 h-10 w-full rounded-md" />
            </div>
            <div className="pt-1">
              <div className="skeleton-shimmer h-10 w-32 rounded-md" />
            </div>
          </div>
        )}

        {mode === 'login' && (
          <div className="mt-5 space-y-4">
            <div>
              <div className="skeleton-shimmer h-4 w-14 rounded" />
              <div className="skeleton-shimmer mt-1.5 h-10 w-full rounded-md" />
            </div>
            <div>
              <div className="skeleton-shimmer h-4 w-20 rounded" />
              <div className="skeleton-shimmer mt-1.5 h-10 w-full rounded-md" />
            </div>
            <div className="skeleton-shimmer h-4 w-28 rounded" />
            <div className="pt-1">
              <div className="skeleton-shimmer h-10 w-28 rounded-md" />
            </div>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <div className="skeleton-shimmer h-4 w-full rounded" />
              <div className="skeleton-shimmer h-4 w-3/4 rounded" />
            </div>
            <div>
              <div className="skeleton-shimmer h-4 w-14 rounded" />
              <div className="skeleton-shimmer mt-1.5 h-10 w-full rounded-md" />
            </div>
            <div className="flex items-center gap-4 pt-1">
              <div className="skeleton-shimmer h-10 w-36 rounded-md" />
              <div className="skeleton-shimmer h-4 w-24 rounded" />
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage({
  initialMode = 'login',
  canRegisterAdmin = false,
  maxAdminAccounts = 2,
}: LoginPageProps) {
  const [loginState, loginAction, loginPending] = useActionState(login, undefined)
  const [resetRequestState, resetRequestAction, resetRequestPending] = useActionState(
    requestPasswordReset,
    undefined,
  )
  const [signupState, signupAction, signupPending] = useActionState(signup, undefined)

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [loginEmail, setLoginEmail] = useState('')
  const [signupRole, setSignupRole] = useState<'user' | 'admin'>('user')
  const [signupUsername, setSignupUsername] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')

  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  const [otpFeedback, setOtpFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [reaccessRequestedLocal, setReaccessRequestedLocal] = useState(false)
  const [reaccessReason, setReaccessReason] = useState('')
  const [isOtpResending, startOtpTransition] = useTransition()
  const [isReaccessSubmitting, startReaccessTransition] = useTransition()

  const isSignUpOpen = mode === 'signup'
  const isPending = loginPending || signupPending || resetRequestPending
  const isAccountLocked = Boolean(loginState?.accountLocked || loginState?.verificationRequired)
  const failedAttempts = loginState?.failedAttempts ?? 0
  const maxAttempts = loginState?.maxAttempts ?? 3
  const remainingAttempts = Math.max(0, maxAttempts - failedAttempts)
  const verificationEmail = (loginEmail || loginState?.verificationEmail || '').trim()
  const hasRequestedReaccess = Boolean(loginState?.reaccessRequested) || reaccessRequestedLocal

  function handleResendOtp() {
    setOtpFeedback(null)
    startOtpTransition(async () => {
      const result = await resendLoginOtp(verificationEmail)
      setOtpFeedback(result)
    })
  }

  function handleRequestAdminReaccess() {
    setOtpFeedback(null)
    startReaccessTransition(async () => {
      const result = await requestAdminReaccess(verificationEmail, reaccessReason)
      if (result.ok) {
        setReaccessRequestedLocal(true)
      }
      setOtpFeedback(result)
    })
  }

  const passwordRequirements = [
    { label: 'At least 8 characters', valid: signupPassword.length >= 8 },
    { label: 'At least one letter', valid: /[a-zA-Z]/.test(signupPassword) },
    { label: 'At least one number', valid: /[0-9]/.test(signupPassword) },
    { label: 'At least one special character', valid: /[^a-zA-Z0-9]/.test(signupPassword) },
  ]

  const hasTypedPassword = signupPassword.length > 0
  const hasTypedConfirmPassword = signupConfirmPassword.length > 0
  const passwordsMatch = signupPassword === signupConfirmPassword

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Top Navbar */}
      <header className="intro-nav">
        <nav
          aria-label="Brand"
          className="flex h-14 items-center justify-between bg-[#5D1A25] px-4 py-3 text-white sm:px-6"
        >
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Chronyx home">
            <img
              src="/chronyx.png"
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="text-lg font-bold tracking-tight">Chronyx</span>
          </Link>
        </nav>
      </header>

      {/* Full-Screen Image Container */}
      <main className="relative flex min-h-[calc(100dvh-3.5rem)] w-full grow items-center justify-center overflow-visible bg-[#fbf8f7] px-4 py-6 md:overflow-hidden md:bg-transparent md:px-6 md:py-8">
        {/* Background Image Layer */}
        <div
          aria-hidden="true"
          className="intro-bg-zoom absolute inset-0 hidden bg-cover bg-center bg-no-repeat md:block"
          style={{ backgroundImage: "url('/OIP.webp')" }}
        />

        {/* Strong Color Overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[#5D1A25] opacity-40 mix-blend-multiply md:block"
        />
        <div aria-hidden="true" className="absolute inset-0 hidden bg-[#5D1A25] opacity-30 md:block" />

        {/* Subtle Glass Tint for a Modern Feel */}
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[#5D1A25]/10 backdrop-blur-[1px] md:block"
        />

        {/* Sliding Auth Card */}
        <section
          aria-label="Account authentication"
          className="intro-card intro-delay-1 relative flex w-full max-w-md flex-col md:h-[min(78vh,45rem)] md:min-h-[34rem] md:w-[88vw] md:max-w-[54rem] md:flex-row md:overflow-hidden md:rounded-xl md:bg-[#5D1A25] md:shadow-[0_14px_40px_rgba(0,0,0,0.4)]"
        >
          {/* Desktop Maroon Welcome Panels (each occupies its exact 40% exposed side) */}
          <div className="hidden w-full justify-between md:flex">
            {/* Left Maroon Side (visible during Login / Forgot Password) */}
            <div
              aria-hidden={isSignUpOpen}
              className="flex w-[40%] flex-col items-center justify-center px-6 py-10 text-center"
            >
              <img
                src="/chronyx.png"
                alt=""
                className="ambient-float mb-5 h-20 w-20 rounded-full border border-white/20 object-cover shadow-md"
              />
              <h2 className="intro-fade-up intro-delay-2 text-xl font-bold tracking-wide text-white">
                Welcome to Chronyx
              </h2>
              <p className="intro-fade-up intro-delay-3 mt-1.5 text-sm text-white/80">
                Your Intelligent Scheduler
              </p>
              <p className="intro-fade-up intro-delay-4 mt-12 text-sm text-white/80">
                Don&apos;t have an account yet?
              </p>
              <button
                type="button"
                disabled={isPending}
                tabIndex={isSignUpOpen ? -1 : 0}
                onClick={() => setMode('signup')}
                className="intro-fade-up intro-delay-4 mt-3 cursor-pointer rounded-lg bg-white px-5 py-2 text-sm font-semibold text-[#5D1A25] shadow-sm hover:-translate-y-0.5 hover:bg-[#f5e9eb] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create Account
              </button>
            </div>

            {/* Right Maroon Side (visible during Sign Up) */}
            <div
              aria-hidden={!isSignUpOpen}
              className="flex w-[40%] flex-col items-center justify-center px-6 py-10 text-center"
            >
              <img
                src="/chronyx.png"
                alt=""
                className="ambient-float mb-5 h-20 w-20 rounded-full border border-white/20 object-cover shadow-md"
              />
              <h2 className="text-xl font-bold tracking-wide text-white">Welcome to Chronyx</h2>
              <p className="mt-1.5 text-sm text-white/80">Your Intelligent Scheduler</p>
              <p className="mt-12 text-sm text-white/80">Already have an account?</p>
              <button
                type="button"
                disabled={isPending}
                tabIndex={isSignUpOpen ? 0 : -1}
                onClick={() => setMode('login')}
                className="mt-3 cursor-pointer rounded-lg bg-white px-5 py-2 text-sm font-semibold text-[#5D1A25] shadow-sm hover:-translate-y-0.5 hover:bg-[#f5e9eb] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                Login
              </button>
            </div>
          </div>

          {/* Sliding White Form Panel (exact 60% width: 0% for Sign Up, 66.6667% = 40%/60% for Login) */}
          <div
            aria-busy={isPending}
            className={`relative flex w-full flex-col rounded-2xl bg-white shadow-[0_12px_35px_rgba(54,24,28,0.12)] transition-transform duration-700 ease-in-out md:absolute md:inset-y-0 md:left-0 md:h-full md:w-[60%] md:rounded-xl md:shadow-none ${
              isPending ? 'overflow-hidden' : 'md:overflow-y-auto'
            } ${
              isSignUpOpen ? 'md:translate-x-0' : 'md:translate-x-[66.6667%]'
            }`}
          >
            {isPending && <FormPendingSkeleton mode={mode} />}

            <div className={`my-auto px-6 py-7 sm:px-10 md:px-12 md:py-9 ${isPending ? 'invisible' : ''}`}>
              {/* Mobile Mode Toggle */}
              {mode !== 'forgot' && (
                <div
                  role="group"
                  aria-label="Authentication mode"
                  className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f5f4] p-1 md:hidden"
                >
                  <button
                    type="button"
                    aria-pressed={!isSignUpOpen}
                    onClick={() => setMode('login')}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      !isSignUpOpen ? 'bg-white text-[#5D1A25] shadow-sm' : 'text-[#75656a]'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    aria-pressed={isSignUpOpen}
                    onClick={() => setMode('signup')}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      isSignUpOpen ? 'bg-white text-[#5D1A25] shadow-sm' : 'text-[#75656a]'
                    }`}
                  >
                    Create account
                  </button>
                </div>
              )}

              {mode === 'signup' && (
                <div key="signup" className="form-panel-enter">
                  <h1 className="text-3xl font-extrabold text-[#5D1A25]">Sign Up</h1>
                  <form action={signupAction} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="signup-role" className="block text-sm font-semibold text-[#5D1A25]">
                        Role
                      </label>
                      <select
                        id="signup-role"
                        name="role"
                        value={canRegisterAdmin ? signupRole : 'user'}
                        onChange={(event) =>
                          setSignupRole(event.target.value === 'admin' ? 'admin' : 'user')
                        }
                        aria-invalid={Boolean(signupState?.errors?.role?.length)}
                        aria-describedby="signup-role-hint"
                        className={`${inputBaseClass} mt-1`}
                      >
                        <option value="user">User</option>
                        <option value="admin" disabled={!canRegisterAdmin}>
                          {canRegisterAdmin ? 'Admin' : 'Admin (Limit reached)'}
                        </option>
                      </select>
                      <p id="signup-role-hint" className="mt-1 text-xs text-gray-500">
                        {canRegisterAdmin
                          ? 'User accounts view schedules. Admin accounts manage schedules.'
                          : `Maximum of ${maxAdminAccounts} admin accounts reached.`}
                      </p>
                      {signupState?.errors?.role?.map((error) => (
                        <p key={error} role="alert" className="mt-1 text-xs font-medium text-red-600">
                          {error}
                        </p>
                      ))}
                    </div>

                    <div>
                      <label htmlFor="signup-username" className="block text-sm font-semibold text-[#5D1A25]">
                        Username
                      </label>
                      <input
                        type="text"
                        id="signup-username"
                        name="username"
                        value={signupUsername}
                        onChange={(event) => setSignupUsername(event.target.value)}
                        autoComplete="username"
                        minLength={8}
                        required
                        aria-invalid={Boolean(signupState?.errors?.username?.length)}
                        aria-describedby="signup-username-hint"
                        className={`${inputBaseClass} mt-1`}
                      />
                      <p id="signup-username-hint" className="mt-1 text-xs text-gray-500">
                        At least 8 characters.
                      </p>
                      {signupState?.errors?.username?.map((error) => (
                        <p key={error} role="alert" className="mt-1 text-xs font-medium text-red-600">
                          {error}
                        </p>
                      ))}
                    </div>

                    <div>
                      <label htmlFor="signup-email" className="block text-sm font-semibold text-[#5D1A25]">
                        Email
                      </label>
                      <input
                        type="email"
                        id="signup-email"
                        name="email"
                        value={signupEmail}
                        onChange={(event) => setSignupEmail(event.target.value)}
                        placeholder="you@gmail.com"
                        autoComplete="email"
                        required
                        aria-invalid={Boolean(signupState?.errors?.email?.length)}
                        aria-describedby="signup-email-hint"
                        className={`${inputBaseClass} mt-1`}
                      />
                      <p id="signup-email-hint" className="mt-1 text-xs text-gray-500">
                        Must be an @gmail.com address.
                      </p>
                      {signupState?.errors?.email?.map((error) => (
                        <p key={error} role="alert" className="mt-1 text-xs font-medium text-red-600">
                          {error}
                        </p>
                      ))}
                    </div>

                    <div>
                      <label htmlFor="signup-password" className="block text-sm font-semibold text-[#5D1A25]">
                        Password
                      </label>
                      <div className="relative mt-1">
                        <input
                          type={showSignupPassword ? 'text' : 'password'}
                          id="signup-password"
                          name="password"
                          value={signupPassword}
                          onChange={(event) => setSignupPassword(event.target.value)}
                          autoComplete="new-password"
                          required
                          aria-invalid={Boolean(signupState?.errors?.password?.length)}
                          className={`${inputBaseClass} pr-16`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#5D1A25] hover:underline"
                          aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                        >
                          {showSignupPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                        {passwordRequirements.map((requirement) => {
                          const statusClass = requirement.valid
                            ? 'text-green-700'
                            : hasTypedPassword
                              ? 'text-red-500'
                              : 'text-gray-500'

                          return (
                            <li key={requirement.label} className={`transition-colors duration-200 ${statusClass}`}>
                              <span
                                key={requirement.valid ? 'valid' : 'invalid'}
                                className={requirement.valid ? 'check-pop mr-1 font-semibold' : 'mr-1'}
                              >
                                {requirement.valid ? '✓' : hasTypedPassword ? '×' : '•'}
                              </span>
                              {requirement.label}
                            </li>
                          )
                        })}
                      </ul>
                      {signupState?.errors?.password?.map((error) => (
                        <p key={error} role="alert" className="mt-1 text-xs font-medium text-red-600">
                          {error}
                        </p>
                      ))}
                    </div>

                    <div>
                      <label
                        htmlFor="signup-confirm-password"
                        className="block text-sm font-semibold text-[#5D1A25]"
                      >
                        Confirm Password
                      </label>
                      <div className="relative mt-1">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          id="signup-confirm-password"
                          name="confirmPassword"
                          value={signupConfirmPassword}
                          onChange={(event) => setSignupConfirmPassword(event.target.value)}
                          autoComplete="new-password"
                          required
                          aria-invalid={Boolean(signupState?.errors?.confirmPassword?.length)}
                          className={`${inputBaseClass} pr-16`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#5D1A25] hover:underline"
                          aria-label={
                            showConfirmPassword
                              ? 'Hide confirmation password'
                              : 'Show confirmation password'
                          }
                        >
                          {showConfirmPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {hasTypedConfirmPassword && (
                        <p
                          className={`mt-1 text-xs font-medium ${
                            passwordsMatch ? 'text-green-700' : 'text-red-500'
                          }`}
                        >
                          {passwordsMatch ? '✓ Passwords match' : 'Passwords do not match'}
                        </p>
                      )}
                      {signupState?.errors?.confirmPassword?.map((error) => (
                        <p key={error} role="alert" className="mt-1 text-xs font-medium text-red-600">
                          {error}
                        </p>
                      ))}
                    </div>

                    {signupState?.message && (
                      <p
                        role="alert"
                        className="alert-shake rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                      >
                        {signupState.message}
                      </p>
                    )}

                    <div className="pt-1">
                      <button disabled={signupPending} type="submit" className={primaryButtonClass}>
                        {signupPending ? 'Creating account...' : 'Sign Up'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {mode === 'forgot' && (
                <div key="forgot" className="form-panel-enter">
                  <h1 className="text-3xl font-extrabold text-[#5D1A25]">Forgot password?</h1>
                  <p className="mt-2 text-sm text-gray-600">
                    Enter your account email and we&apos;ll send a password reset link if it matches an
                    account.
                  </p>
                  <form action={resetRequestAction} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="reset-email" className="block text-sm font-semibold text-[#5D1A25]">
                        Email
                      </label>
                      <input
                        type="email"
                        id="reset-email"
                        name="email"
                        value={loginEmail}
                        onChange={(event) => {
                          setLoginEmail(event.target.value)
                          setOtpFeedback(null)
                          setReaccessRequestedLocal(false)
                          setReaccessReason('')
                        }}
                        placeholder="you@gmail.com"
                        autoComplete="email"
                        required
                        aria-invalid={Boolean(resetRequestState?.errors?.email?.length)}
                        className={`${inputBaseClass} mt-1`}
                      />
                      {resetRequestState?.errors?.email?.map((error) => (
                        <p key={error} role="alert" className="mt-1 text-xs font-medium text-red-600">
                          {error}
                        </p>
                      ))}
                    </div>

                    {resetRequestState?.message && (
                      <p
                        role="status"
                        className="form-panel-enter rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
                      >
                        {resetRequestState.message}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <button
                        disabled={resetRequestPending}
                        type="submit"
                        className={primaryButtonClass}
                      >
                        {resetRequestPending ? 'Sending...' : 'Send reset link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="text-sm font-medium text-[#5D1A25] underline hover:text-[#762331]"
                      >
                        Back to login
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {mode === 'login' && (
                <div key="login" className="form-panel-enter">
                  <h1 className="text-3xl font-extrabold text-[#5D1A25]">Login</h1>
                  <form action={loginAction} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="login-email" className="block text-sm font-semibold text-[#5D1A25]">
                        Email
                      </label>
                      <input
                        type="email"
                        id="login-email"
                        name="email"
                        value={loginEmail}
                        onChange={(event) => {
                          setLoginEmail(event.target.value)
                          setOtpFeedback(null)
                          setReaccessRequestedLocal(false)
                          setReaccessReason('')
                        }}
                        placeholder="you@gmail.com"
                        autoComplete="email"
                        required
                        aria-invalid={Boolean(loginState?.errors?.email?.length)}
                        className={`${inputBaseClass} mt-1`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="login-password"
                        className="block text-sm font-semibold text-[#5D1A25]"
                      >
                        Password
                      </label>
                      <div className="relative mt-1">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          id="login-password"
                          name="password"
                          autoComplete="current-password"
                          required
                          aria-invalid={Boolean(loginState?.errors?.password?.length)}
                          className={`${inputBaseClass} pr-16`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#5D1A25] hover:underline"
                          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        >
                          {showLoginPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    {isAccountLocked && (
                      <div className="form-panel-enter space-y-3 rounded-lg border border-red-200 bg-red-50/70 p-3.5">
                        {/* Account Locked Indicator */}
                        <div className="flex items-start gap-2.5">
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
                          >
                            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                              <rect
                                x="4"
                                y="9"
                                width="12"
                                height="8"
                                rx="2"
                                stroke="currentColor"
                                strokeWidth="1.7"
                              />
                              <path
                                d="M7 9V6.5a3 3 0 1 1 6 0V9"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-red-800">Account Locked</span>
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                {failedAttempts || maxAttempts}/{maxAttempts} failed attempts
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-red-700/90">
                              {loginState?.otpMessage ||
                                'Too many failed login attempts. Verify with your 6-digit OTP or submit a re-access request to an administrator.'}
                            </p>
                          </div>
                        </div>

                        {/* Option 1: 6-Digit Email OTP */}
                        <div className="rounded-md border border-[#e5cfd3] bg-white p-3">
                          <label
                            htmlFor="otpCode"
                            className="block text-xs font-semibold text-[#5D1A25]"
                          >
                            Verify with 6-digit OTP
                          </label>
                          <div className="mt-1.5 flex gap-2">
                            <input
                              type="text"
                              id="otpCode"
                              name="otpCode"
                              inputMode="numeric"
                              maxLength={6}
                              autoComplete="one-time-code"
                              placeholder="000000"
                              aria-invalid={Boolean(loginState?.errors?.verification?.length)}
                              className={`${inputBaseClass} bg-white font-mono tracking-[0.25em] placeholder:tracking-[0.2em]`}
                            />
                            <button
                              type="button"
                              onClick={handleResendOtp}
                              disabled={isOtpResending || loginPending}
                              className="shrink-0 rounded-md border border-[#d9bfc4] bg-[#fbf5f6] px-3 py-2 text-xs font-semibold text-[#5D1A25] hover:bg-[#f4e4e7] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isOtpResending ? 'Sending...' : 'Resend OTP'}
                            </button>
                          </div>
                          {loginState?.errors?.verification?.map((error) => (
                            <p key={error} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                              {error}
                            </p>
                          ))}
                        </div>

                        {/* Option 2: User-Initiated Admin Re-access Request */}
                        <div className="rounded-md border border-[#e5cfd3] bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor="reaccessReason"
                              className="block text-xs font-semibold text-[#5D1A25]"
                            >
                              Or request administrator re-access
                            </label>
                            {hasRequestedReaccess && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                                Request sent
                              </span>
                            )}
                          </div>

                          {hasRequestedReaccess ? (
                            <p role="status" className="mt-1.5 text-xs leading-relaxed text-green-800">
                              Your re-access request has been sent to administrators. Once approved, sign in again with your password.
                            </p>
                          ) : (
                            <>
                              <p className="mt-1 text-[11px] text-gray-600">
                                Administrators only unlock accounts after you submit a re-access request.
                              </p>
                              <input
                                type="text"
                                id="reaccessReason"
                                value={reaccessReason}
                                onChange={(event) => setReaccessReason(event.target.value)}
                                maxLength={200}
                                placeholder="Optional note (e.g., locked out after typing wrong password)"
                                className={`${inputBaseClass} mt-2 text-xs`}
                              />
                              <button
                                type="button"
                                onClick={handleRequestAdminReaccess}
                                disabled={isReaccessSubmitting || loginPending}
                                className="mt-2 inline-flex items-center rounded-md bg-[#5D1A25] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#762331] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isReaccessSubmitting ? 'Submitting request...' : 'Submit Re-access Request'}
                              </button>
                            </>
                          )}
                        </div>

                        {otpFeedback && (
                          <p
                            role="status"
                            className={`text-xs font-medium ${
                              otpFeedback.ok ? 'text-green-700' : 'text-amber-700'
                            }`}
                          >
                            {otpFeedback.message}
                          </p>
                        )}
                      </div>
                    )}

                    {Boolean(loginState?.errors?.email?.length || loginState?.errors?.password?.length) && (
                      <div
                        role="alert"
                        className="alert-shake space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                      >
                        {loginState?.errors?.email?.map((error) => (
                          <p key={error}>{error}</p>
                        ))}
                        {loginState?.errors?.password?.map((error) => (
                          <p key={error}>{error}</p>
                        ))}
                        {!isAccountLocked && failedAttempts > 0 && remainingAttempts > 0 && (
                          <p className="text-xs font-semibold text-amber-800">
                            {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining
                            before your account is locked.
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="block text-sm font-medium text-[#5D1A25] underline hover:text-[#762331]"
                    >
                      Forgot password?
                    </button>

                    <div className="pt-1">
                      <button disabled={loginPending} type="submit" className={primaryButtonClass}>
                        {loginPending ? 'Logging in...' : 'Login'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
