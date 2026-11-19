'use client'

/* eslint-disable @next/next/no-img-element */
import AccountMenu from '@/app/components/account-menu'
import { useEffect, useState, type FormEvent } from 'react'
import {
  formatScheduleTime,
  getScheduleEventStyle,
  type ScheduleAssignment,
  type ScheduleDay,
} from '@/lib/schedule'
import { roomTypes, type RoomType } from '@/lib/rooms'
import type { SchedulePolicy } from '@/lib/schedule-policy'

type ScheduleProps = {
  name: string
  email: string
  assignments: ScheduleAssignment[]
  curriculumOptions: CurriculumOption[]
  schedulePolicy: SchedulePolicy
}

type CurriculumOption = {
  id: string
  name: string
  code: string
  category: string
}

type ScheduleView = 'week' | 'day'
type ScheduleRequest = {
  id: string
  subject: string
  category?: string
  classType: RoomType
  day: ScheduleDay
  startTime: string
  endTime: string
  status: 'pending' | 'approved' | 'rejected'
}
type RoomAvailability = {
  name: string
  status: 'available' | 'occupied'
  conflicts: Array<{ startTime: string; endTime: string }>
}

const minZoom = 80
const maxZoom = 400
const zoomStep = 10
const defaultZoom = 400
const baseDayWidth = 180

function getTimeMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function formatTimeMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function NavigationIcon({ type }: { type: 'dashboard' | 'schedule' | 'subjects' | 'settings' }) {
  if (type === 'dashboard') {
    return <img src="/svg/dashboard_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'schedule') {
    return <img src="/svg/schedule_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'subjects') {
    return <img src="/svg/subject_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Schedule({ name, email, assignments, curriculumOptions, schedulePolicy }: ScheduleProps) {
  const days = schedulePolicy.teachingDays
  const scheduleStartMinute = getTimeMinutes(schedulePolicy.dayStartTime)
  const scheduleEndMinute = getTimeMinutes(schedulePolicy.dayEndTime)
  const scheduleDurationHours = (scheduleEndMinute - scheduleStartMinute) / 60
  const hours = Array.from(
    { length: Math.ceil(scheduleDurationHours / 2) + 1 },
    (_, index) => scheduleStartMinute + index * 120,
  ).filter((minute) => minute < scheduleEndMinute)
  hours.push(scheduleEndMinute)
  const defaultRequestEnd = formatTimeMinutes(Math.min(scheduleStartMinute + 60, scheduleEndMinute))
  const [view, setView] = useState<ScheduleView>('day')
  const [selectedDay, setSelectedDay] = useState<ScheduleDay>(days[0])
  const [selectedWeekDays, setSelectedWeekDays] = useState<ScheduleDay[]>([...days])
  const [today, setToday] = useState('')
  const [zoom, setZoom] = useState(defaultZoom)
  const [requests, setRequests] = useState<ScheduleRequest[]>([])
  const [roomAvailability, setRoomAvailability] = useState<RoomAvailability[]>([])
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [requestCategory, setRequestCategory] = useState('')
  const [requestCurriculumId, setRequestCurriculumId] = useState('')
  const [requestClassType, setRequestClassType] = useState<RoomType>('lecture')
  const [requestDay, setRequestDay] = useState<ScheduleDay>(days[0])
  const [requestStart, setRequestStart] = useState(schedulePolicy.dayStartTime)
  const [requestEnd, setRequestEnd] = useState(defaultRequestEnd)
  const [requestError, setRequestError] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const visibleDays = view === 'week' ? days.filter((day) => selectedWeekDays.includes(day)) : [selectedDay]
  const dayColumnWidth = Math.round(baseDayWidth * zoom / 100)
  const timelineMinWidth = 190 + visibleDays.length * dayColumnWidth + 32
  const visibleAssignments = assignments
    .filter((assignment) => visibleDays.includes(assignment.day))
    .sort((first, second) => (
      visibleDays.indexOf(first.day) - visibleDays.indexOf(second.day)
      || first.startTime.localeCompare(second.startTime)
      || first.subject.localeCompare(second.subject)
    ))
  const requestConflicts = assignments.filter((assignment) => (
    assignment.day === requestDay
    && assignment.startTime < requestEnd
    && assignment.endTime > requestStart
  ))
  const curriculumCategories = [...new Set(curriculumOptions.map((option) => option.category))]
    .sort((first, second) => first.localeCompare(second))
  const categoryCurriculumOptions = curriculumOptions.filter((option) => option.category === requestCategory)
  const selectedCurriculumOption = categoryCurriculumOptions.find((option) => option.id === requestCurriculumId)

  useEffect(() => {
    const controller = new AbortController()
    if (requestStart >= requestEnd) return () => controller.abort()

    async function loadRoomAvailability() {
      setIsLoadingAvailability(true)
      setAvailabilityError('')
      try {
        const query = new URLSearchParams({
          day: requestDay,
          startTime: requestStart,
          endTime: requestEnd,
          classType: requestClassType,
        })
        const response = await fetch(`/api/schedule-availability?${query}`, { signal: controller.signal })
        const result = await response.json() as { data?: RoomAvailability[]; message?: string }
        if (!response.ok) throw new Error(result.message || 'Room availability could not be loaded.')
        setRoomAvailability(result.data ?? [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setAvailabilityError(error instanceof Error ? error.message : 'Room availability could not be loaded.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingAvailability(false)
      }
    }

    void loadRoomAvailability()
    return () => controller.abort()
  }, [requestClassType, requestDay, requestEnd, requestStart])

  useEffect(() => {
    const controller = new AbortController()
    async function loadRequests() {
      try {
        const response = await fetch('/api/schedule-requests', { signal: controller.signal })
        const result = await response.json() as { data?: ScheduleRequest[]; message?: string }
        if (!response.ok) throw new Error(result.message || 'Schedule requests could not be loaded.')
        setRequests(result.data ?? [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setRequestError(error instanceof Error ? error.message : 'Schedule requests could not be loaded.')
        }
      }
    }

    void loadRequests()
    return () => controller.abort()
  }, [])

  async function submitScheduleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestError('')
    setRequestMessage('')
    setIsSubmittingRequest(true)
    try {
      const response = await fetch('/api/schedule-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedCurriculumOption?.name,
          category: selectedCurriculumOption?.category,
          classType: requestClassType,
          day: requestDay,
          startTime: requestStart,
          endTime: requestEnd,
        }),
      })
      const result = await response.json() as {
        data?: ScheduleRequest
        message?: string
        conflicts?: Array<{ subject: string; startTime: string; endTime: string }>
      }
      if (!response.ok) throw new Error(result.message || 'The schedule request could not be sent.')
      if (result.data) setRequests((current) => [result.data!, ...current])
      setRequestCategory('')
      setRequestCurriculumId('')
      setRequestMessage(result.message || 'Schedule request sent to the administrator.')
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'The schedule request could not be sent.')
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  useEffect(() => {
    const refreshToday = () => {
      const now = new Date()
      setToday(
        new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }).format(now),
      )

      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now)
      const matchingDay = days.find((day) => day === weekday)
      if (matchingDay) setSelectedDay(matchingDay)
    }

    refreshToday()
    document.addEventListener('visibilitychange', refreshToday)
    return () => document.removeEventListener('visibilitychange', refreshToday)
  }, [days])

  return (
    <main className="min-h-screen bg-[#f7f5f4] text-[#29282b]">
      <header className="sticky top-0 z-30 h-[60px] border-b border-white/10 bg-[#5d1a25]/95 text-white shadow-sm backdrop-blur-md">
        <div className="flex h-full w-full items-center justify-between px-5 sm:px-8">
          <a href="/dashboard" className="flex items-center gap-3" aria-label="Chronyx dashboard">
            <img src="/chronyx.png" alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-base font-bold tracking-tight">Chronyx</span>
          </a>
          <AccountMenu name={name} email={email} />
        </div>
      </header>

      <nav
        aria-label="Dashboard navigation"
        className="flex flex-wrap items-center justify-center gap-1 bg-[#5d1a25] px-2 py-2 text-white shadow-md sm:gap-3 lg:fixed lg:left-5 lg:top-1/2 lg:z-20 lg:w-56 lg:-translate-y-1/2 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-1.5 lg:rounded-2xl lg:border lg:border-white/15 lg:bg-[#5d1a25]/95 lg:px-2.5 lg:py-3 lg:shadow-[0_12px_30px_rgba(54,24,28,0.28)] lg:backdrop-blur-md"
      >
        {[
          { label: 'Dashboard', type: 'dashboard' as const, href: '/dashboard', active: false },
          { label: 'My Schedule', type: 'schedule' as const, href: '/schedule', active: true },
          { label: 'Curriculum Subjects', type: 'subjects' as const, href: '/subjects', active: false },
          { label: 'Settings', type: 'settings' as const, href: '/settings', active: false },
        ].map((item) => (
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
      </nav>

      <div className="mx-auto w-full max-w-[1480px] px-5 py-6 sm:px-8 sm:py-10 lg:pl-72 lg:pr-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#171719]">
              My Schedule
            </h1>
            <p aria-live="polite" className="mt-1 text-sm text-[#9a6e75]">
              {today ? `Today · ${today}` : 'Loading date…'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#d9c9cc] bg-white p-1 shadow-sm" aria-label="Schedule view">
              {(['week', 'day'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d1a25] ${
                    view === option ? 'bg-[#5d1a25] text-white' : 'text-[#705c60] hover:bg-[#f6eff0]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {view === 'day' && (
              <>
                <label className="sr-only" htmlFor="schedule-day">Choose a day</label>
                <select
                  id="schedule-day"
                  value={selectedDay}
                  onChange={(event) => setSelectedDay(event.target.value as ScheduleDay)}
                  className="rounded-lg border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#5d1a25] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d1a25]"
                >
                  {days.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </>
            )}
            {view === 'week' && (
              <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#705c60]">
                <legend className="sr-only">Filter weekly schedule by day</legend>
                {days.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedWeekDays.includes(day)}
                      onChange={() => setSelectedWeekDays((current) => (
                        current.includes(day)
                          ? current.filter((selectedDay) => selectedDay !== day)
                          : [...current, day]
                      ))}
                      className="accent-[#5d1a25]"
                    />
                    {day}
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedWeekDays([...days])}
                  disabled={selectedWeekDays.length === days.length}
                  className="font-medium text-[#5d1a25] hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-50"
                >
                  All days
                </button>
              </fieldset>
            )}
          </div>
        </div>

        <section aria-labelledby="schedule-request-title" className="mb-5 rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)] sm:p-5">
          <h2 id="schedule-request-title" className="text-sm font-semibold text-[#5d1a25]">Request a preferred schedule</h2>
          <p className="mt-1 text-[11px] text-[#8b777b]">
            Send your preferred subject and class time to the administrator for review.
          </p>
          <form onSubmit={submitScheduleRequest} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Category
              <select
                required
                value={requestCategory}
                onChange={(event) => {
                  setRequestCategory(event.target.value)
                  setRequestCurriculumId('')
                }}
                disabled={isSubmittingRequest || curriculumCategories.length === 0}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
              >
                <option value="">Select a category</option>
                {curriculumCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Subject / class
              <select
                required
                value={requestCurriculumId}
                onChange={(event) => setRequestCurriculumId(event.target.value)}
                disabled={isSubmittingRequest || !requestCategory}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
              >
                <option value="">Select a subject/class</option>
                {categoryCurriculumOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code ? `${option.code} · ` : ''}{option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Class type
              <select
                value={requestClassType}
                onChange={(event) => setRequestClassType(event.target.value as RoomType)}
                disabled={isSubmittingRequest}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
              >
                {roomTypes.map((type) => (
                  <option key={type} value={type}>{type === 'lab' ? 'Lab' : 'Lecture'}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Day
              <select
                value={requestDay}
                onChange={(event) => setRequestDay(event.target.value as ScheduleDay)}
                disabled={isSubmittingRequest}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
              >
                {days.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Start time
              <input
                type="time"
                required
                min={schedulePolicy.dayStartTime}
                max={schedulePolicy.dayEndTime}
                value={requestStart}
                onChange={(event) => setRequestStart(event.target.value)}
                disabled={isSubmittingRequest}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              End time
              <input
                type="time"
                required
                min={schedulePolicy.dayStartTime}
                max={schedulePolicy.dayEndTime}
                value={requestEnd}
                onChange={(event) => setRequestEnd(event.target.value)}
                disabled={isSubmittingRequest}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmittingRequest || !selectedCurriculumOption || requestStart >= requestEnd}
                className="rounded-md bg-[#5d1a25] px-4 py-2 text-xs font-semibold text-white hover:bg-[#43121a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingRequest ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </form>
          {curriculumOptions.length === 0 && (
            <p role="status" className="mt-3 text-xs text-[#8b777b]">
              No curriculum subjects are available. Ask your administrator to add subjects before requesting a schedule.
            </p>
          )}
          <div className="mt-4 rounded-lg border border-[#eee6e7] bg-[#faf7f8] p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#5d1a25]">
                {requestClassType === 'lab' ? 'Lab' : 'Lecture'} room availability · {requestDay}
              </h3>
              <span className="text-[10px] text-[#8b777b]">{formatScheduleTime(requestStart)}–{formatScheduleTime(requestEnd)}</span>
            </div>
            <p className="mt-1 text-[10px] text-[#8b777b]">
              A time may still be requested when another class is in session, as long as a matching room is free.
            </p>
            {requestStart >= requestEnd ? (
              <p className="mt-2 text-xs text-[#8b777b]">Choose an end time after the start time to check availability.</p>
            ) : isLoadingAvailability ? (
              <p role="status" className="mt-2 text-xs text-[#8b777b]">Checking room availability…</p>
            ) : availabilityError ? (
              <p role="alert" className="mt-2 text-xs text-red-700">{availabilityError}</p>
            ) : roomAvailability.length > 0 ? (
              <ul className="mt-2 divide-y divide-[#eee6e7]">
                {roomAvailability.map((room) => (
                  <li key={room.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-xs">
                    <span className="font-medium text-[#514a4c]">{room.name}</span>
                    <span className={`font-semibold ${room.status === 'available' ? 'text-green-800' : 'text-amber-800'}`}>
                      {room.status === 'available' ? 'Available' : 'Occupied'}
                    </span>
                    {room.conflicts.length > 0 && (
                      <span className="w-full text-[10px] text-[#8b777b]">
                        Busy {room.conflicts.map((conflict) => (
                          `${formatScheduleTime(conflict.startTime)}–${formatScheduleTime(conflict.endTime)}`
                        )).join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[#8b777b]">No matching rooms are available for scheduling.</p>
            )}
          </div>
          {requestConflicts.length > 0 && (
            <p role="status" className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Warning: this time overlaps {requestConflicts.map((assignment) => (
                `${assignment.subject} (${assignment.startTime}–${assignment.endTime})`
              )).join(', ')} on your schedule. You can still send the request for admin review.
            </p>
          )}
          {requestError && <p role="alert" className="mt-3 text-xs text-red-700">{requestError}</p>}
          {requestMessage && <p role="status" className="mt-3 text-xs text-green-800">{requestMessage}</p>}
          {requests.length > 0 && (
            <div className="mt-4 border-t border-[#eee6e7] pt-3">
              <h3 className="text-xs font-semibold text-[#514a4c]">Your schedule requests</h3>
              <ul className="mt-2 space-y-2">
                {requests.map((scheduleRequest) => (
                  <li key={scheduleRequest.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#514a4c]">
                      {scheduleRequest.subject}{scheduleRequest.category ? ` · ${scheduleRequest.category}` : ''} · {scheduleRequest.classType === 'lab' ? 'Lab' : 'Lecture'} · {scheduleRequest.day}, {formatScheduleTime(scheduleRequest.startTime)}–{formatScheduleTime(scheduleRequest.endTime)}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${
                      scheduleRequest.status === 'approved' ? 'bg-green-50 text-green-800'
                        : scheduleRequest.status === 'rejected' ? 'bg-red-50 text-red-800'
                          : 'bg-amber-50 text-amber-800'
                    }`}>
                      {scheduleRequest.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div>
          <section
            aria-labelledby="schedule-title"
            className="min-w-0 overflow-hidden rounded-lg bg-white shadow-[0_2px_5px_rgba(31,41,55,0.16)]"
          >
            <section aria-labelledby="schedule-list-title" className="border-b border-[#eee6e7] px-4 py-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="schedule-list-title" className="text-sm font-semibold text-[#5d1a25]">
                  {view === 'week' ? 'Schedule list' : `${selectedDay} schedule list`}
                </h3>
                <p className="text-[10px] text-[#8b777b]">
                  {visibleAssignments.length} class{visibleAssignments.length === 1 ? '' : 'es'}
                </p>
              </div>
              {visibleAssignments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#eee6e7] text-[10px] uppercase tracking-wide text-[#8b777b]">
                        <th scope="col" className="px-3 py-2 font-medium">Day</th>
                        <th scope="col" className="px-3 py-2 font-medium">Time</th>
                        <th scope="col" className="px-3 py-2 font-medium">Subject</th>
                        <th scope="col" className="px-3 py-2 font-medium">Type</th>
                        <th scope="col" className="px-3 py-2 font-medium">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3edef]">
                      {visibleAssignments.map((assignment) => (
                        <tr key={assignment.id} className="text-[#514a4c]">
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-[#302326]">{assignment.day}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {formatScheduleTime(assignment.startTime)}–{formatScheduleTime(assignment.endTime)}
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-medium text-[#302326]">{assignment.subject}</span>
                            {assignment.category && (
                              <span className="ml-1.5 text-[#8b777b]">· {assignment.category}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">{assignment.classType === 'lab' ? 'Lab' : 'Lecture'}</td>
                          <td className="whitespace-nowrap px-3 py-3">{assignment.room || 'Room unassigned'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg bg-[#faf7f8] px-4 py-5 text-center text-xs text-[#8b777b]">
                  {view === 'day'
                    ? `No classes assigned on ${selectedDay}.`
                    : selectedWeekDays.length === 0
                      ? 'Select at least one day to view your schedule.'
                      : 'No classes are assigned on the selected days.'}
                </p>
              )}
            </section>
            <div className="flex flex-col gap-3 border-b border-[#eee6e7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="schedule-title" className="text-sm font-semibold text-[#5d1a25]">
                  {view === 'week' ? 'My Weekly Schedule' : `My ${selectedDay} Schedule`}
                </h2>
                <p className="mt-0.5 text-[10px] text-[#8b777b]">
                  Class times · {formatScheduleTime(schedulePolicy.dayStartTime)}–{formatScheduleTime(schedulePolicy.dayEndTime)}
                </p>
              </div>
              <div
                role="group"
                aria-label="Schedule zoom controls"
                className="flex w-fit items-center gap-1 rounded-lg border border-[#e7dfe1] bg-white p-1"
              >
                <button
                  type="button"
                  aria-label="Zoom out"
                  disabled={zoom <= minZoom}
                  onClick={() => setZoom((current) => Math.max(minZoom, current - zoomStep))}
                  className="flex h-7 w-7 items-center justify-center rounded text-base text-[#5d1a25] hover:bg-[#f6eff0] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label={`Reset zoom, currently ${zoom}%`}
                  onClick={() => setZoom(defaultZoom)}
                  className="min-w-12 rounded px-1 text-[10px] font-medium text-[#705c60] hover:bg-[#f6eff0]"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  disabled={zoom >= maxZoom}
                  onClick={() => setZoom((current) => Math.min(maxZoom, current + zoomStep))}
                  className="flex h-7 w-7 items-center justify-center rounded text-base text-[#5d1a25] hover:bg-[#f6eff0] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="p-3 sm:p-4" style={{ minWidth: `${timelineMinWidth}px` }}>
                <div
                  className="grid border-b border-[#e7dfe1]"
                  style={{
                    gridTemplateColumns: `190px repeat(${visibleDays.length}, minmax(${dayColumnWidth}px, 1fr))`,
                  }}
                >
                  <div className="flex items-end px-2 pb-2 text-[10px] font-medium uppercase tracking-wide text-[#8b777b]">
                    My Classes
                  </div>
                  {visibleDays.map((day) => (
                    <div key={day} className="border-l border-[#eee6e7] px-2 pt-1">
                      <h3 className="mb-2 text-center text-[11px] font-semibold text-[#5d1a25]">{day}</h3>
                      <div className="relative h-3 text-[9px] text-[#8b777b]">
                        {hours.map((minute) => (
                          <span
                            key={minute}
                            className={`absolute ${
                              minute === scheduleStartMinute ? 'translate-x-0'
                                : minute === scheduleEndMinute ? '-translate-x-full'
                                  : '-translate-x-1/2'
                            }`}
                            style={{ left: `${((minute - scheduleStartMinute) / (scheduleEndMinute - scheduleStartMinute)) * 100}%` }}
                          >
                            {formatScheduleTime(formatTimeMinutes(minute))}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="grid min-h-[220px]"
                  style={{
                    gridTemplateColumns: `190px repeat(${visibleDays.length}, minmax(${dayColumnWidth}px, 1fr))`,
                  }}
                >
                  <div aria-hidden="true" className="border-b border-[#eee6e7]" />
                  {visibleDays.map((day) => {
                    const dayAssignments = assignments.filter((assignment) => assignment.day === day)

                    return (
                      <div
                        key={day}
                        aria-label={`${day}, ${dayAssignments.length} classes`}
                        className="relative min-h-[220px] border-b border-l border-[#eee6e7]"
                        style={{
                          backgroundImage: 'linear-gradient(to right, #f0ebec 1px, transparent 1px)',
                          backgroundSize: `${100 / scheduleDurationHours}% 100%`,
                          backgroundRepeat: 'repeat-x',
                        }}
                      >
                        {dayAssignments.map((assignment) => (
                          <article
                            key={assignment.id}
                            aria-label={`${assignment.subject}${assignment.category ? `, ${assignment.category}` : ''}, ${assignment.room || 'room unassigned'}, ${formatScheduleTime(assignment.startTime)} to ${formatScheduleTime(assignment.endTime)}`}
                            title={`${assignment.subject}${assignment.category ? ` · ${assignment.category}` : ''} · ${assignment.classType === 'lab' ? 'Lab' : 'Lecture'} · ${assignment.room || 'Room unassigned'} · ${formatScheduleTime(assignment.startTime)}–${formatScheduleTime(assignment.endTime)}`}
                            className="absolute top-3 flex h-14 flex-col justify-center overflow-hidden rounded-md border border-[#d8abb2] bg-[#f7ecee] px-2 text-[10px] text-[#5d1a25] shadow-sm"
                            style={getScheduleEventStyle(
                              assignment.startTime,
                              assignment.endTime,
                              schedulePolicy.dayStartTime,
                              schedulePolicy.dayEndTime,
                            )}
                          >
                            <span className="truncate font-semibold">
                              {assignment.subject}{assignment.category ? ` · ${assignment.category}` : ''}
                            </span>
                            <span className="truncate text-[9px]">{assignment.classType === 'lab' ? 'Lab' : 'Lecture'}</span>
                            <span className="truncate text-[9px]">{assignment.room || 'Room unassigned'}</span>
                            <span className="truncate text-[9px]">
                              {formatScheduleTime(assignment.startTime)}–{formatScheduleTime(assignment.endTime)}
                            </span>
                          </article>
                        ))}
                      </div>
                    )
                  })}
                  {visibleAssignments.length === 0 && (
                    <div className="col-span-full flex items-center justify-center px-4 py-8 text-center">
                      <div>
                        <p className="text-sm font-medium text-[#514a4c]">
                          {assignments.length === 0
                            ? 'Your schedule is not available yet'
                            : view === 'day'
                              ? `No classes assigned on ${selectedDay}.`
                              : selectedWeekDays.length === 0
                                ? 'Select at least one day to view your schedule.'
                                : 'No classes are assigned on the selected days.'}
                        </p>
                        <p className="mt-1 text-xs text-[#8b777b]">
                          {assignments.length === 0
                            ? 'Once your subjects are assigned, your class schedule will appear here.'
                            : 'Choose different days or select all days to see more classes.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
