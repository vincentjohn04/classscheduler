'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeOwnPassword, deleteOwnAccount, updateOwnName } from '@/app/api/server/auth/auth'
import type {
  ChangePasswordState,
  DeleteAccountState,
  UpdateNameState,
} from '@/app/api/server/auth/definition'

type AccountSettingsCardProps = {
  initialName: string
  email: string
  accountType: string
  variant?: 'card' | 'modal'
  onNameUpdated?: (nextName: string) => void
}

const inputClass =
  'mt-1 w-full rounded-md border border-[#dfd2d4] bg-[#fdfbfa] px-3 py-2 text-xs text-[#292326] placeholder:text-[#9c8c90] focus:border-[#5d1a25] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5d1a25]/20'

const submitButtonClass =
  'inline-flex items-center justify-center rounded-md bg-[#5d1a25] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#762331] disabled:cursor-not-allowed disabled:opacity-60'

export default function AccountSettingsCard({
  initialName,
  email,
  accountType,
  variant = 'card',
  onNameUpdated,
}: AccountSettingsCardProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'delete'>('profile')
  const [isDeleteExpanded, setIsDeleteExpanded] = useState(false)

  const [nameInput, setNameInput] = useState(initialName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showDeletePassword, setShowDeletePassword] = useState(false)

  const [nameState, nameAction, namePending] = useActionState<UpdateNameState, FormData>(
    async (prevState, formData) => {
      const result = await updateOwnName(prevState, formData)
      if (result?.success && result.updatedName) {
        setNameInput(result.updatedName)
        onNameUpdated?.(result.updatedName)
        router.refresh()
      }
      return result
    },
    undefined,
  )

  const [passwordState, passwordAction, passwordPending] = useActionState<
    ChangePasswordState,
    FormData
  >(async (prevState, formData) => {
    const result = await changeOwnPassword(prevState, formData)
    if (result?.success) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    return result
  }, undefined)

  const [deleteState, deleteAction, deletePending] = useActionState<
    DeleteAccountState,
    FormData
  >(deleteOwnAccount, undefined)

  const passwordRequirements = [
    { label: '8+ characters', valid: newPassword.length >= 8 },
    { label: 'One letter', valid: /[a-zA-Z]/.test(newPassword) },
    { label: 'One number', valid: /[0-9]/.test(newPassword) },
    { label: 'One special char', valid: /[^a-zA-Z0-9]/.test(newPassword) },
  ]

  const hasTypedNewPassword = newPassword.length > 0
  const hasTypedConfirmPassword = confirmPassword.length > 0
  const passwordsMatch = newPassword === confirmPassword

  const nameForm = (
    <form action={nameAction} className="space-y-3">
      <div>
        <label htmlFor={`${variant}-display-name`} className="block text-xs font-semibold text-[#5d1a25]">
          Display name
        </label>
        <input
          id={`${variant}-display-name`}
          name="name"
          type="text"
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
          minLength={2}
          maxLength={80}
          required
          autoComplete="name"
          aria-invalid={Boolean(nameState?.errors?.name?.length)}
          className={inputClass}
        />
        {nameState?.errors?.name?.map((error) => (
          <p key={error} role="alert" className="mt-1 text-[11px] font-medium text-red-600">
            {error}
          </p>
        ))}
      </div>

      <div className="grid gap-2 rounded-md border border-[#efe6e8] bg-[#faf7f7] px-3 py-2 text-[11px] text-[#6d5c60]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-[#8b777b]">Email</span>
          <span className="truncate font-medium text-[#292326]">{email}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-[#8b777b]">Role</span>
          <span className="font-medium text-[#292326]">{accountType}</span>
        </div>
      </div>

      {nameState?.message && (
        <p
          role={nameState.success ? 'status' : 'alert'}
          className={`rounded-md border px-3 py-2 text-xs ${
            nameState.success
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {nameState.message}
        </p>
      )}

      <button type="submit" disabled={namePending} className={submitButtonClass}>
        {namePending ? 'Saving name...' : 'Save Name'}
      </button>
    </form>
  )

  const passwordForm = (
    <form action={passwordAction} className="space-y-3">
      <div>
        <label
          htmlFor={`${variant}-current-password`}
          className="block text-xs font-semibold text-[#5d1a25]"
        >
          Current password
        </label>
        <div className="relative mt-1">
          <input
            id={`${variant}-current-password`}
            name="currentPassword"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={Boolean(passwordState?.errors?.currentPassword?.length)}
            className={`${inputClass} mt-0 pr-14`}
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#5d1a25] hover:underline"
          >
            {showCurrentPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {passwordState?.errors?.currentPassword?.map((error) => (
          <p key={error} role="alert" className="mt-1 text-[11px] font-medium text-red-600">
            {error}
          </p>
        ))}
      </div>

      <div>
        <label
          htmlFor={`${variant}-new-password`}
          className="block text-xs font-semibold text-[#5d1a25]"
        >
          New password
        </label>
        <div className="relative mt-1">
          <input
            id={`${variant}-new-password`}
            name="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={Boolean(passwordState?.errors?.newPassword?.length)}
            className={`${inputClass} mt-0 pr-14`}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#5d1a25] hover:underline"
          >
            {showNewPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
          {passwordRequirements.map((req) => (
            <li
              key={req.label}
              className={
                req.valid ? 'text-green-700' : hasTypedNewPassword ? 'text-red-500' : 'text-gray-500'
              }
            >
              {req.valid ? '✓' : hasTypedNewPassword ? '×' : '•'} {req.label}
            </li>
          ))}
        </ul>

        {passwordState?.errors?.newPassword?.map((error) => (
          <p key={error} role="alert" className="mt-1 text-[11px] font-medium text-red-600">
            {error}
          </p>
        ))}
      </div>

      <div>
        <label
          htmlFor={`${variant}-confirm-password`}
          className="block text-xs font-semibold text-[#5d1a25]"
        >
          Confirm new password
        </label>
        <div className="relative mt-1">
          <input
            id={`${variant}-confirm-password`}
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={Boolean(passwordState?.errors?.confirmPassword?.length)}
            className={`${inputClass} mt-0 pr-14`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#5d1a25] hover:underline"
          >
            {showConfirmPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {hasTypedConfirmPassword && (
          <p
            className={`mt-1 text-[11px] font-medium ${
              passwordsMatch ? 'text-green-700' : 'text-red-500'
            }`}
          >
            {passwordsMatch ? '✓ Passwords match' : 'Passwords do not match'}
          </p>
        )}
        {passwordState?.errors?.confirmPassword?.map((error) => (
          <p key={error} role="alert" className="mt-1 text-[11px] font-medium text-red-600">
            {error}
          </p>
        ))}
      </div>

      {passwordState?.message && (
        <p
          role={passwordState.success ? 'status' : 'alert'}
          className={`rounded-md border px-3 py-2 text-xs ${
            passwordState.success
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {passwordState.message}
        </p>
      )}

      <button type="submit" disabled={passwordPending} className={submitButtonClass}>
        {passwordPending ? 'Updating password...' : 'Change Password'}
      </button>
    </form>
  )

  const deleteForm = (
    <form action={deleteAction} className="space-y-3">
      <div className="rounded-md border border-red-200 bg-red-50/80 px-3 py-2.5 text-xs leading-relaxed text-red-800">
        Deleting your account is permanent and removes your profile, active sessions, and any
        assigned schedules or schedule requests.
      </div>

      <div>
        <label
          htmlFor={`${variant}-delete-password`}
          className="block text-xs font-semibold text-red-800"
        >
          Current password
        </label>
        <div className="relative mt-1">
          <input
            id={`${variant}-delete-password`}
            name="password"
            type={showDeletePassword ? 'text' : 'password'}
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={Boolean(deleteState?.errors?.password?.length)}
            className={`${inputClass} mt-0 border-red-200 pr-14 focus:border-red-600 focus:ring-red-600/20`}
          />
          <button
            type="button"
            onClick={() => setShowDeletePassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-red-700 hover:underline"
          >
            {showDeletePassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {deleteState?.errors?.password?.map((error) => (
          <p key={error} role="alert" className="mt-1 text-[11px] font-medium text-red-600">
            {error}
          </p>
        ))}
      </div>

      <div>
        <label
          htmlFor={`${variant}-delete-confirm`}
          className="block text-xs font-semibold text-red-800"
        >
          Type <span className="font-mono font-bold">DELETE</span> to confirm
        </label>
        <input
          id={`${variant}-delete-confirm`}
          name="confirmation"
          type="text"
          value={deleteConfirmation}
          onChange={(event) => setDeleteConfirmation(event.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          required
          aria-invalid={Boolean(deleteState?.errors?.confirmation?.length)}
          className={`${inputClass} border-red-200 font-mono focus:border-red-600 focus:ring-red-600/20`}
        />
        {deleteState?.errors?.confirmation?.map((error) => (
          <p key={error} role="alert" className="mt-1 text-[11px] font-medium text-red-600">
            {error}
          </p>
        ))}
      </div>

      {deleteState?.message && (
        <p
          role="alert"
          className="alert-shake rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {deleteState.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={deletePending || deleteConfirmation.trim() !== 'DELETE'}
          className="inline-flex items-center justify-center rounded-md bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deletePending ? 'Deleting account...' : 'Permanently Delete Account'}
        </button>
        {variant === 'card' && (
          <button
            type="button"
            onClick={() => {
              setIsDeleteExpanded(false)
              setDeletePassword('')
              setDeleteConfirmation('')
            }}
            className="rounded-md border border-[#e5d8db] px-3 py-2 text-xs font-medium text-[#5d1a25] hover:bg-[#fbf5f6]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )

  if (variant === 'modal') {
    return (
      <div className="mt-4">
        <div
          role="group"
          aria-label="Account settings tabs"
          className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-[#f6f1f2] p-1"
        >
          <button
            type="button"
            aria-pressed={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            className={`rounded-md px-2 py-1.5 text-xs font-semibold ${
              activeTab === 'profile'
                ? 'bg-white text-[#5d1a25] shadow-sm'
                : 'text-[#6e5e62] hover:text-[#292326]'
            }`}
          >
            Name
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'password'}
            onClick={() => setActiveTab('password')}
            className={`rounded-md px-2 py-1.5 text-xs font-semibold ${
              activeTab === 'password'
                ? 'bg-white text-[#5d1a25] shadow-sm'
                : 'text-[#6e5e62] hover:text-[#292326]'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'delete'}
            onClick={() => setActiveTab('delete')}
            className={`rounded-md px-2 py-1.5 text-xs font-semibold ${
              activeTab === 'delete'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-[#8c3d48] hover:text-red-700'
            }`}
          >
            Delete
          </button>
        </div>

        <div key={activeTab} className="form-panel-enter">
          {activeTab === 'profile' && nameForm}
          {activeTab === 'password' && passwordForm}
          {activeTab === 'delete' && deleteForm}
        </div>
      </div>
    )
  }

  return (
    <section
      id="account-security"
      aria-labelledby="account-security-title"
      className="mt-4 rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)] sm:p-5"
    >
      <div className="border-b border-[#efe6e8] pb-3">
        <h2 id="account-security-title" className="text-sm font-semibold text-[#85545d]">
          Account &amp; Security
        </h2>
        <p className="mt-0.5 text-[11px] text-[#8b777b]">
          Update your display name, change your password, or delete your account.
        </p>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2 md:divide-x md:divide-[#efe6e8]">
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#5d1a25]">
            Profile Name
          </h3>
          {nameForm}
        </div>

        <div className="md:pl-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#5d1a25]">
            Change Password
          </h3>
          {passwordForm}
        </div>
      </div>

      <div className="mt-6 border-t border-red-100 pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-red-700">
              Delete Account
            </h3>
            <p className="mt-0.5 text-[11px] text-[#8b777b]">
              Permanently remove your account and sign out of Chronyx.
            </p>
          </div>
          {!isDeleteExpanded && (
            <button
              type="button"
              onClick={() => setIsDeleteExpanded(true)}
              className="w-fit rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Delete Account
            </button>
          )}
        </div>

        {isDeleteExpanded && (
          <div className="form-panel-enter mt-4 max-w-md">{deleteForm}</div>
        )}
      </div>
    </section>
  )
}
