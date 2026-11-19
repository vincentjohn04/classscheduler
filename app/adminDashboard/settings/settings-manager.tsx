'use client'

import { useState, type FormEvent } from 'react'
import { scheduleDays, type ScheduleDay } from '@/lib/schedule'

export type AcademicSettings = {
  academicTerm: 'First Semester' | 'Second Semester' | 'Summer'
  academicYear: number
  teachingDays: ScheduleDay[]
  dayStartTime: string
  dayEndTime: string
}

type SettingsManagerProps = {
  initialSettings: AcademicSettings
  setupStatus: {
    facultyCount: number
    roomCount: number
    subjectCount: number
  }
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-[#e5d8db] bg-white px-3 py-2.5 text-sm text-[#302326] outline-none focus:border-[#8d4a57] focus:ring-2 focus:ring-[#8d4a57]/15'
const setupItems = [
  { key: 'facultyCount', label: 'Faculty accounts', href: '/adminDashboard', action: 'View dashboard' },
  { key: 'roomCount', label: 'Available rooms', href: '/adminDashboard/rooms', action: 'Manage rooms' },
  { key: 'subjectCount', label: 'Curriculum subjects', href: '/subjects', action: 'Manage subjects' },
] as const

export default function SettingsManager({ initialSettings, setupStatus }: SettingsManagerProps) {
  const [academicTerm, setAcademicTerm] = useState<AcademicSettings['academicTerm']>(initialSettings.academicTerm)
  const [academicYear, setAcademicYear] = useState(initialSettings.academicYear.toString())
  const [teachingDays, setTeachingDays] = useState<ScheduleDay[]>(initialSettings.teachingDays)
  const [dayStartTime, setDayStartTime] = useState(initialSettings.dayStartTime)
  const [dayEndTime, setDayEndTime] = useState(initialSettings.dayEndTime)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function saveAcademicSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicTerm,
          academicYear: Number(academicYear),
          teachingDays,
          dayStartTime,
          dayEndTime,
        }),
      })
      const result = await response.json() as {
        data?: AcademicSettings
        message?: string
      }
      if (!response.ok) throw new Error(result.message || 'The workspace settings could not be saved.')
      if (!result.data) throw new Error('The saved workspace settings were not returned by the server.')

      setAcademicTerm(result.data.academicTerm)
      setAcademicYear(result.data.academicYear.toString())
      setTeachingDays(result.data.teachingDays)
      setDayStartTime(result.data.dayStartTime)
      setDayEndTime(result.data.dayEndTime)
      setNotice(result.message || 'Workspace settings saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The workspace settings could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
      <section aria-labelledby="academic-period-title" className="rounded-2xl border border-[#eadde0] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8eff1] text-[#7c3643]">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 13h3m2 0h3m-8 4h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h2 id="academic-period-title" className="text-base font-semibold text-[#302326]">Academic period and teaching hours</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#796a6e]">
              Set the active academic term and the days and hours used for scheduling.
            </p>
          </div>
        </div>

        <form onSubmit={saveAcademicSettings}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-[#5b4b50]">
              Semester
              <select
                value={academicTerm}
                onChange={(event) => setAcademicTerm(event.target.value as AcademicSettings['academicTerm'])}
                disabled={isSaving}
                className={inputClass}
              >
                <option>First Semester</option>
                <option>Second Semester</option>
                <option>Summer</option>
              </select>
            </label>
            <label className="text-xs font-medium text-[#5b4b50]">
              Starting year
              <input
                required
                type="number"
                min={2000}
                max={2100}
                step={1}
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </label>
          </div>
          <fieldset className="mt-5">
            <legend className="text-xs font-medium text-[#5b4b50]">Teaching days</legend>
            <p className="mt-1 text-xs text-[#8b777b]">Select at least one day for classes and schedule requests.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scheduleDays.map((day) => {
                const checked = teachingDays.includes(day)
                return (
                  <label
                    key={day}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                      checked ? 'border-[#8d4a57] bg-[#f8eff1] text-[#5d1a25]' : 'border-[#e5d8db] text-[#705c60]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSaving || (checked && teachingDays.length === 1)}
                      onChange={() => setTeachingDays((current) => (
                        current.includes(day)
                          ? current.filter((selectedDay) => selectedDay !== day)
                          : scheduleDays.filter((candidate) => current.includes(candidate) || candidate === day)
                      ))}
                      className="accent-[#5d1a25]"
                    />
                    {day}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-[#5b4b50]">
              Teaching day starts
              <input
                required
                type="time"
                value={dayStartTime}
                onChange={(event) => setDayStartTime(event.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </label>
            <label className="text-xs font-medium text-[#5b4b50]">
              Teaching day ends
              <input
                required
                type="time"
                value={dayEndTime}
                onChange={(event) => setDayEndTime(event.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-[#8b777b]">
            Current label: <span className="font-semibold text-[#5d1a25]">{academicTerm} {academicYear || '—'}</span>
          </p>
          <button
            type="submit"
            disabled={isSaving || !academicYear || teachingDays.length === 0 || dayStartTime >= dayEndTime}
            className="mt-4 rounded-lg bg-[#5d1a25] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#48131c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save settings'}
          </button>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}
        </form>
      </section>

      <section aria-labelledby="setup-status-title" className="rounded-2xl border border-[#eadde0] bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 id="setup-status-title" className="text-base font-semibold text-[#302326]">Scheduling setup</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#796a6e]">
            Check the resources used by class requests and schedule generation.
          </p>
        </div>
        <ul className="mt-4 divide-y divide-[#f1e8ea]">
          {setupItems.map((item) => {
            const count = setupStatus[item.key]
            return (
              <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#302326]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[#8b777b]">
                    {count} configured
                    {count === 0 && item.key !== 'facultyCount' ? ' · needed for schedule generation' : ''}
                  </p>
                </div>
                <a href={item.href} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-[#7c3643] hover:bg-[#faf4f5]">
                  {item.action}
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="schedule-rules-title" className="rounded-2xl border border-[#eadde0] bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="schedule-rules-title" className="text-base font-semibold text-[#302326]">Schedule generation rules</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#796a6e]">
              Chronyx applies these safeguards automatically when generating or editing schedules.
            </p>
          </div>
          <a href="/adminDashboard/schedule" className="w-fit rounded-lg bg-[#f8eff1] px-3.5 py-2 text-xs font-semibold text-[#6e303b] hover:bg-[#f1e2e5]">
            Open schedule manager
          </a>
        </div>
        <ul className="mt-4 grid gap-3 text-sm text-[#5b4b50] sm:grid-cols-2 xl:grid-cols-4">
          <li className="rounded-xl bg-[#faf7f8] p-3.5">
            <p className="font-semibold text-[#302326]">Teaching hours</p>
            <p className="mt-1 text-xs leading-relaxed text-[#796a6e]">Classes run between {dayStartTime} and {dayEndTime}.</p>
          </li>
          <li className="rounded-xl bg-[#faf7f8] p-3.5">
            <p className="font-semibold text-[#302326]">Teaching days</p>
            <p className="mt-1 text-xs leading-relaxed text-[#796a6e]">{teachingDays.join(', ')}.</p>
          </li>
          <li className="rounded-xl bg-[#faf7f8] p-3.5">
            <p className="font-semibold text-[#302326]">Conflict checks</p>
            <p className="mt-1 text-xs leading-relaxed text-[#796a6e]">Faculty and room overlaps are prevented.</p>
          </li>
          <li className="rounded-xl bg-[#faf7f8] p-3.5">
            <p className="font-semibold text-[#302326]">Room matching</p>
            <p className="mt-1 text-xs leading-relaxed text-[#796a6e]">Class type and room preference are respected.</p>
          </li>
        </ul>
      </section>
    </div>
  )
}
