'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  isRoomCompatibleWithClassType,
  type RoomType,
  type RoomUsageType,
} from '@/lib/rooms'
import {
  formatMeetingPattern,
  formatScheduleTime,
  getPatternDays,
  getRecommendedSchedulePreset,
  getScheduleEventStyle,
  layoutOverlappingEvents,
  meetingPatterns,
  scheduleDays,
  type MeetingPattern,
  type ScheduleAssignment,
  type ScheduleClassRequest,
  type ScheduleDay,
  type SchedulePreferenceRequest,
} from '@/lib/schedule'
import type { SchedulePolicy } from '@/lib/schedule-policy'

type FacultyMember = {
  id: string
  name: string
  email: string
}

type RoomOption = {
  id: string
  name: string
  type: RoomUsageType
}

type CurriculumOption = {
  id: string
  name: string
  code: string
  units?: number
  category: string
}

type ScheduleManagerProps = {
  facultyMembers: FacultyMember[]
  initialSchedules: ScheduleAssignment[]
  initialPending: ScheduleClassRequest[]
  initialRequests: SchedulePreferenceRequest[]
  initialRooms: RoomOption[]
  initialCurriculum: CurriculumOption[]
  schedulePolicy: SchedulePolicy
}

const minTimelineZoom = 70
const maxTimelineZoom = 220
const timelineZoomStep = 15
const baseHourHeight = 56
const baseTimelineDayWidth = 180

function sortAssignments(assignments: ScheduleAssignment[]) {
  return [...assignments].sort((a, b) => (
    scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day)
    || a.startTime.localeCompare(b.startTime)
  ))
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} hr${hours === 1 ? '' : 's'} ${minutes} min`
}

function getTimeMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function getSubjectColor(subject: string, classType: RoomType) {
  const palettes = [
    { border: 'border-[#7c3aed]', background: 'bg-[#f3e8ff]', text: 'text-[#4c1d95]' },
    { border: 'border-[#0284c7]', background: 'bg-[#e0f2fe]', text: 'text-[#0c4a6e]' },
    { border: 'border-[#059669]', background: 'bg-[#d1fae5]', text: 'text-[#064e3b]' },
    { border: 'border-[#d97706]', background: 'bg-[#fef3c7]', text: 'text-[#78350f]' },
    { border: 'border-[#db2777]', background: 'bg-[#fce7f3]', text: 'text-[#831843]' },
    { border: 'border-[#4f46e5]', background: 'bg-[#e0e7ff]', text: 'text-[#312e81]' },
    { border: 'border-[#0d9488]', background: 'bg-[#ccfbf1]', text: 'text-[#134e4a]' },
    { border: 'border-[#ea580c]', background: 'bg-[#ffedd5]', text: 'text-[#7c2d12]' },
  ]
  let hash = 0
  for (const character of subject.trim().toLocaleLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  const palette = palettes[hash % palettes.length]
  return {
    border: palette.border,
    background: classType === 'lab' ? 'bg-[#fff4d6]' : palette.background,
    text: classType === 'lab' ? 'text-[#633d08]' : palette.text,
  }
}

export default function ScheduleManager({
  facultyMembers,
  initialSchedules,
  initialPending,
  initialRequests,
  initialRooms,
  initialCurriculum,
  schedulePolicy,
}: ScheduleManagerProps) {
  const [assignments, setAssignments] = useState(sortAssignments(initialSchedules))
  const [pendingClasses, setPendingClasses] = useState(initialPending)
  const [scheduleRequests, setScheduleRequests] = useState(initialRequests)
  const [timelineZoom, setTimelineZoom] = useState(100)
  const [timelineFacultyFilter, setTimelineFacultyFilter] = useState('all')
  const roomOptions = initialRooms
  const [classType, setClassType] = useState<RoomType>('lecture')
  const [meetingPattern, setMeetingPattern] = useState<MeetingPattern>('single')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [facultyId, setFacultyId] = useState(facultyMembers[0]?.id ?? '')
  const [category, setCategory] = useState('')
  const [selectedCurriculumId, setSelectedCurriculumId] = useState('')
  const [durationHours, setDurationHours] = useState('1')
  const [durationRemainder, setDurationRemainder] = useState('0')
  const [editing, setEditing] = useState<ScheduleAssignment | null>(null)
  const [editFacultyId, setEditFacultyId] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCurriculumId, setEditCurriculumId] = useState('')
  const [editClassType, setEditClassType] = useState<RoomType>('lecture')
  const [editDay, setEditDay] = useState<ScheduleDay>(schedulePolicy.teachingDays[0])
  const [editRoom, setEditRoom] = useState('')
  const [editStartTime, setEditStartTime] = useState('08:00')
  const [editEndTime, setEditEndTime] = useState('09:00')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [reviewingRequestId, setReviewingRequestId] = useState('')
  const [requestReviewError, setRequestReviewError] = useState('')
  const [requestReviewNotice, setRequestReviewNotice] = useState('')
  const classDurationMinutes = Number(durationHours) * 60 + Number(durationRemainder)
  const scheduleStartMinute = getTimeMinutes(schedulePolicy.dayStartTime)
  const scheduleEndMinute = getTimeMinutes(schedulePolicy.dayEndTime)
  const scheduleDurationMinutes = Math.max(60, scheduleEndMinute - scheduleStartMinute)
  const scheduleDurationHours = scheduleDurationMinutes / 60
  const timelineHourHeight = Math.round(baseHourHeight * timelineZoom / 100)
  const timelineHeight = Math.max(260, Math.round(scheduleDurationHours * timelineHourHeight))
  const timelineDayWidth = Math.round(baseTimelineDayWidth * Math.max(100, timelineZoom) / 100)
  const timelineMinWidth = 92 + schedulePolicy.teachingDays.length * timelineDayWidth + 24
  const timelineMarkers = Array.from(
    { length: Math.ceil(scheduleDurationHours) + 1 },
    (_, index) => scheduleStartMinute + index * 60,
  ).filter((minute) => minute < scheduleEndMinute)
  timelineMarkers.push(scheduleEndMinute)
  const filteredTimelineAssignments = timelineFacultyFilter === 'all'
    ? assignments
    : assignments.filter((assignment) => assignment.facultyId === timelineFacultyFilter)
  const curriculumCategories = [...new Set(initialCurriculum.map((subject) => subject.category))]
  const subjectOptions = initialCurriculum.filter((subject) => subject.category === category)
  const selectedCurriculum = subjectOptions.find((subject) => subject.id === selectedCurriculumId)
  const editSubjectOptions = initialCurriculum.filter((subject) => subject.category === editCategory)
  const editCurriculum = editSubjectOptions.find((subject) => subject.id === editCurriculumId)
  const compatibleRoomOptions = roomOptions.filter((room) =>
    isRoomCompatibleWithClassType(room.type, classType),
  )
  const editRoomOptions = roomOptions.filter((room) =>
    isRoomCompatibleWithClassType(room.type, editClassType),
  )
  const selectedCompatibleRoomId = compatibleRoomOptions.some((room) => room.id === selectedRoomId)
    ? selectedRoomId
    : ''
  const allowedMinuteValues = [0, 15, 30, 45].filter((minutes) => (
    Number(durationHours) * 60 + minutes <= 780
    && (Number(durationHours) > 0 || minutes > 0)
  ))

  function isPatternSupported(pattern: MeetingPattern) {
    const days = getPatternDays(pattern)
    return days.every((day) => schedulePolicy.teachingDays.includes(day))
  }

  function applyRecommendedPreset(units: number | undefined, nextType: RoomType) {
    const preset = getRecommendedSchedulePreset(units, nextType)
    if (isPatternSupported(preset.pattern)) {
      setMeetingPattern(preset.pattern)
      setDurationHours(preset.durationHours)
      setDurationRemainder(preset.durationMinutes)
    } else {
      setMeetingPattern('single')
      setDurationHours(units && units >= 1 && units <= 3 && nextType === 'lecture' ? String(units) : '3')
      setDurationRemainder('0')
    }
  }

  function handlePatternChange(nextPattern: MeetingPattern) {
    setMeetingPattern(nextPattern)
    if (nextPattern === 'MWF') {
      setDurationHours('1')
      setDurationRemainder('0')
    } else if (nextPattern === 'TTh' || nextPattern === 'MW') {
      setDurationHours('1')
      setDurationRemainder('30')
    } else if (classType === 'lab' || selectedCurriculum?.units === 3) {
      setDurationHours('3')
      setDurationRemainder('0')
    }
  }

  const selectedFacultyScheduledMinutes = assignments
    .filter((item) => item.facultyId === facultyId)
    .reduce((sum, item) => sum + item.durationMinutes, 0)
  const selectedFacultyPendingMinutes = pendingClasses
    .filter((item) => item.facultyId === facultyId)
    .reduce((sum, item) => sum + item.durationMinutes, 0)
  const selectedFacultyTotalHours = (selectedFacultyScheduledMinutes + selectedFacultyPendingMinutes) / 60

  async function addClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!selectedCurriculum) {
      setError('Choose a subject and class category from the recorded curriculum.')
      return
    }
    setIsSaving(true)

    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId,
          subject: selectedCurriculum.name,
          category: selectedCurriculum.category,
          classType,
          meetingPattern,
          preferredRoom: roomOptions.find((room) => room.id === selectedCompatibleRoomId)?.name,
          durationMinutes: classDurationMinutes,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.message ?? 'The class could not be added.')
        return
      }

      const addedItems = Array.isArray(result.data) ? result.data : [result.data]
      setPendingClasses((current) => [...current, ...addedItems])
      setCategory('')
      setSelectedCurriculumId('')
    } catch {
      setError('Unable to reach the server. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function generateSchedule() {
    setError('')
    setNotice('')
    setIsGenerating(true)

    try {
      const currentResponse = await fetch('/api/schedules')
      const currentResult = await currentResponse.json() as {
        message?: string
        data?: {
          schedules: ScheduleAssignment[]
          pending: ScheduleClassRequest[]
        }
      }
      if (!currentResponse.ok || !currentResult.data) {
        setError(currentResult.message ?? 'The schedule queue could not be refreshed.')
        return
      }

      setAssignments(sortAssignments(currentResult.data.schedules))
      setPendingClasses(currentResult.data.pending)
      if (currentResult.data.pending.length === 0) {
        setError('There are no classes waiting on the server. The schedule list has been refreshed; add a class before generating.')
        return
      }

      const response = await fetch('/api/schedules/generate', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 400) {
          const refreshedResponse = await fetch('/api/schedules')
          const refreshedResult = await refreshedResponse.json() as {
            data?: {
              schedules: ScheduleAssignment[]
              pending: ScheduleClassRequest[]
            }
          }
          if (refreshedResponse.ok && refreshedResult.data) {
            setAssignments(sortAssignments(refreshedResult.data.schedules))
            setPendingClasses(refreshedResult.data.pending)
          }
        }
        setError(result.message ?? 'The schedule could not be generated.')
        return
      }

      setAssignments((current) => sortAssignments([...current, ...result.data]))
      setPendingClasses([])
      setNotice(result.mode === 'automatic'
        ? `Scheduled and saved ${result.data.length} class${result.data.length === 1 ? '' : 'es'} using Philippine academic scheduling rules (standard bell blocks, 12:00–1:00 PM lunch protection, synchronized MWF/TTh patterns, and zero conflicts).`
        : `Generated and saved ${result.data.length} class${result.data.length === 1 ? '' : 'es'} using AI + Philippine academic scheduling rules with zero faculty or room conflicts.`)
    } catch {
      setError('Unable to reach the server. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  function beginEdit(assignment: ScheduleAssignment) {
    setEditing(assignment)
    setEditFacultyId(assignment.facultyId)
    const curriculumEntry = initialCurriculum.find((subject) => (
      subject.name === assignment.subject
      && (!assignment.category || subject.category === assignment.category)
    ))
    setEditCategory(curriculumEntry?.category ?? '')
    setEditCurriculumId(curriculumEntry?.id ?? '')
    setEditClassType(assignment.classType)
    setEditDay(assignment.day)
    setEditRoom(assignment.room)
    setEditStartTime(assignment.startTime)
    setEditEndTime(assignment.endTime)
    setError('')
    setNotice('')
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return

    setError('')
    setNotice('')
    if (!editCurriculum) {
      setError('Choose a subject and class category from the recorded curriculum.')
      return
    }
    setIsSaving(true)

    try {
      const response = await fetch('/api/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          facultyId: editFacultyId,
          subject: editCurriculum.name,
          category: editCurriculum.category,
          classType: editClassType,
          day: editDay,
          room: editRoom,
          startTime: editStartTime,
          endTime: editEndTime,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.message ?? 'The class could not be updated.')
        return
      }

      setAssignments((current) => sortAssignments(
        current.map((assignment) => assignment.id === editing.id ? result.data : assignment),
      ))
      setEditing(null)
      setNotice('Class schedule updated.')
    } catch {
      setError('Unable to reach the server. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function removeClass(id: string) {
    setError('')
    setNotice('')

    try {
      const response = await fetch(`/api/schedules?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) {
        setError(result.message ?? 'The class could not be removed.')
        return
      }

      setAssignments((current) => current.filter((assignment) => assignment.id !== id))
      setPendingClasses((current) => current.filter((classRequest) => classRequest.id !== id))
      if (editing?.id === id) setEditing(null)
    } catch {
      setError('Unable to reach the server. Please try again.')
    }
  }

  async function reviewScheduleRequest(id: string, decision: 'approved' | 'rejected') {
    setRequestReviewError('')
    setRequestReviewNotice('')
    setReviewingRequestId(id)
    try {
      const response = await fetch('/api/schedule-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision }),
      })
      const result = await response.json() as {
        message?: string
        data?: ScheduleAssignment
      }
      if (!response.ok) throw new Error(result.message || 'The schedule request could not be reviewed.')

      setScheduleRequests((current) => current.map((request) => (
        request.id === id ? { ...request, status: decision } : request
      )))
      if (result.data) setAssignments((current) => sortAssignments([...current, result.data!]))
      setRequestReviewNotice(result.message || `Schedule request ${decision}.`)
    } catch (reviewError) {
      setRequestReviewError(reviewError instanceof Error ? reviewError.message : 'The schedule request could not be reviewed.')
    } finally {
      setReviewingRequestId('')
    }
  }

  return (
    <>
      <section aria-labelledby="schedule-requests-title" className="mb-5 rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="schedule-requests-title" className="text-sm font-semibold text-[#5d1a25]">Faculty schedule requests</h2>
            <p className="mt-1 text-[11px] text-[#8b777b]">Review faculty members’ preferred days and times.</p>
          </div>
          <span className="rounded-full bg-[#f7ecee] px-2.5 py-1 text-[10px] font-semibold text-[#5d1a25]">
            {scheduleRequests.filter((request) => request.status === 'pending').length} pending
          </span>
        </div>
        {requestReviewError && <p role="alert" className="mt-3 text-xs text-red-700">{requestReviewError}</p>}
        {requestReviewNotice && <p role="status" className="mt-3 text-xs text-green-800">{requestReviewNotice}</p>}
        {scheduleRequests.length === 0 ? (
          <p className="mt-4 rounded-md bg-[#faf7f7] px-3 py-4 text-center text-xs text-[#8b777b]">No faculty schedule requests yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#eee6e7]">
            {scheduleRequests.map((request) => (
              <li key={request.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#383236]">
                    {request.subject}{request.category ? ` · ${request.category}` : ''} · {request.classType === 'lab' ? 'Lab' : 'Lecture'} · {request.facultyName}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8b777b]">
                    {request.facultyEmail} · {request.day}, {formatScheduleTime(request.startTime)}–{formatScheduleTime(request.endTime)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${
                    request.status === 'approved' ? 'bg-green-50 text-green-800'
                      : request.status === 'rejected' ? 'bg-red-50 text-red-800'
                        : 'bg-amber-50 text-amber-800'
                  }`}>
                    {request.status}
                  </span>
                  {request.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void reviewScheduleRequest(request.id, 'approved')}
                        disabled={!!reviewingRequestId}
                        className="rounded-md bg-[#5d1a25] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#43121a] disabled:opacity-50"
                      >
                        {reviewingRequestId === request.id ? 'Reviewing…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewScheduleRequest(request.id, 'rejected')}
                        disabled={!!reviewingRequestId}
                        className="rounded-md border border-[#d9c9cc] px-3 py-1.5 text-[11px] font-semibold text-[#705c60] hover:bg-[#faf7f7] disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="add-schedule-title" className="mb-5 rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)] sm:p-5">
        <h2 id="add-schedule-title" className="text-sm font-semibold text-[#5d1a25]">Classes to schedule</h2>
        <p className="mt-1 text-[11px] text-[#8b777b]">
          Follows Philippine academic scheduling (CHED): assigns classes on {schedulePolicy.teachingDays.join(', ')} ({schedulePolicy.dayStartTime}–{schedulePolicy.dayEndTime}), protects the 12:00 PM–1:00 PM lunch break, aligns MWF (1h) / TTh (1.5h) bell blocks at the same time &amp; room, and avoids over 3 consecutive teaching hours without a break.
        </p>
        {initialCurriculum.length === 0 && (
          <p className="mt-2 text-[11px] text-amber-800">
            Add curriculum records on the <a href="/subjects" className="font-semibold underline">Curriculum Subjects page</a> before scheduling classes.
          </p>
        )}
        <div className="mt-4 rounded-md border border-[#eee2e4] bg-[#fbf8f8] p-3">
          {compatibleRoomOptions.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label htmlFor="schedule-room-picker" className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[#705c60]">
                Room preference (optional)
                <select
                  id="schedule-room-picker"
                  value={selectedCompatibleRoomId}
                  onChange={(event) => setSelectedRoomId(event.target.value)}
                  className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
                >
                  <option value="">Automatically select a compatible room</option>
                  {compatibleRoomOptions.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <a href="/adminDashboard/rooms" className="text-[11px] font-medium text-[#5d1a25] hover:underline">
                Manage room list
              </a>
            </div>
          ) : roomOptions.length > 0 ? (
            <p className="text-[11px] text-amber-800">
              No {classType === 'lab' ? 'Lab' : 'Lecture'} rooms are available. Add a compatible room on the <a href="/adminDashboard/rooms" className="font-semibold underline">Rooms page</a>.
            </p>
          ) : (
            <p className="text-[11px] text-amber-800">
              No rooms are available. Add rooms on the <a href="/adminDashboard/rooms" className="font-semibold underline">Rooms page</a> first.
            </p>
          )}
          <p className="mt-2 text-[10px] text-[#8b777b]">
            {compatibleRoomOptions.length} compatible {classType === 'lab' ? 'Lab' : 'Lecture'} room{compatibleRoomOptions.length === 1 ? '' : 's'}.
            {' '}Choose one to reserve your preference, or leave automatic selection for conflict-aware room assignment.
          </p>
        </div>
        <form onSubmit={addClass} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
            Faculty member
            <select
              required
              value={facultyId}
              onChange={(event) => setFacultyId(event.target.value)}
              disabled={facultyMembers.length === 0 || isSaving}
              className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236] disabled:bg-[#f5f2f2]"
            >
              {facultyMembers.length === 0 && <option value="">No faculty available</option>}
              {facultyMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
            Class / category
            <select
              required
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setSelectedCurriculumId('')
              }}
              disabled={isSaving || curriculumCategories.length === 0}
              className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236] disabled:bg-[#f5f2f2]"
            >
              <option value="" disabled>
                {curriculumCategories.length ? 'Select class category' : 'No curriculum recorded'}
              </option>
              {curriculumCategories.map((classCategory) => (
                <option key={classCategory} value={classCategory}>{classCategory}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
            Subject
            <select
              required
              value={selectedCurriculumId}
              onChange={(event) => {
                const nextId = event.target.value
                setSelectedCurriculumId(nextId)
                const matched = subjectOptions.find((subject) => subject.id === nextId)
                applyRecommendedPreset(matched?.units, classType)
              }}
              disabled={isSaving || subjectOptions.length === 0}
              className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236] disabled:bg-[#f5f2f2]"
            >
              <option value="" disabled>
                {subjectOptions.length ? 'Select subject' : 'Select a class category first'}
              </option>
              {subjectOptions.map((subjectOption) => (
                <option key={subjectOption.id} value={subjectOption.id}>
                  {subjectOption.name} · {subjectOption.code || 'No code'} · {subjectOption.units ?? 'Units not recorded'} units
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
            Room type
            <select
              value={classType}
              onChange={(event) => {
                const nextType = event.target.value as RoomType
                setClassType(nextType)
                setSelectedRoomId('')
                applyRecommendedPreset(selectedCurriculum?.units, nextType)
              }}
              disabled={isSaving}
              className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
            >
              <option value="lecture">Lecture</option>
              <option value="lab">Lab</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
            Meeting pattern
            <select
              value={meetingPattern}
              onChange={(event) => handlePatternChange(event.target.value as MeetingPattern)}
              disabled={isSaving}
              className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
            >
              {meetingPatterns.map((pattern) => {
                const supported = isPatternSupported(pattern)
                return (
                  <option key={pattern} value={pattern} disabled={!supported}>
                    {formatMeetingPattern(pattern)}{!supported ? ' (Day disabled)' : ''}
                  </option>
                )
              })}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
            <legend>Duration</legend>
            <div className="flex gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-1.5">
                <select
                  aria-label="Duration hours"
                  value={durationHours}
                  onChange={(event) => {
                    const hours = event.target.value
                    setDurationHours(hours)
                    if (Number(hours) * 60 + Number(durationRemainder) > 780) setDurationRemainder('0')
                    if (Number(hours) === 0 && Number(durationRemainder) === 0) setDurationRemainder('15')
                  }}
                  disabled={isSaving}
                  className="w-full rounded-md border border-[#d9c9cc] bg-white px-2 py-2 text-xs text-[#383236]"
                >
                  {Array.from({ length: 14 }, (_, hour) => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
                <span>hr</span>
              </label>
              <label className="flex min-w-0 flex-1 items-center gap-1.5">
                <select
                  aria-label="Duration minutes"
                  value={durationRemainder}
                  onChange={(event) => setDurationRemainder(event.target.value)}
                  disabled={isSaving}
                  className="w-full rounded-md border border-[#d9c9cc] bg-white px-2 py-2 text-xs text-[#383236]"
                >
                  {allowedMinuteValues.map((minute) => (
                    <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>
                  ))}
                </select>
                <span>min</span>
              </label>
            </div>
          </fieldset>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!facultyId || !selectedCurriculum || isSaving}
              className="rounded-md bg-[#5d1a25] px-4 py-2 text-xs font-medium text-white hover:bg-[#43121a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Add class'}
            </button>
          </div>
        </form>

        {facultyId && (
          <p className={`mt-3 text-[11px] ${selectedFacultyTotalHours > 24 ? 'font-medium text-amber-800' : 'text-[#8b777b]'}`}>
            Selected faculty weekly load:{' '}
            <span className="font-semibold text-[#5d1a25]">
              {(selectedFacultyScheduledMinutes / 60).toFixed(1)} hrs scheduled
            </span>
            {selectedFacultyPendingMinutes > 0
              ? ` + ${(selectedFacultyPendingMinutes / 60).toFixed(1)} hrs queued (${selectedFacultyTotalHours.toFixed(1)} hrs total)`
              : ''}
            {' · '}CHED regular full-time norm: 18–24 hrs/week.
            {selectedFacultyTotalHours > 24 ? ' (Exceeds 24 hrs/week regular load.)' : ''}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#eee6e7] pt-4">
          <button
            type="button"
            onClick={() => void generateSchedule()}
            disabled={pendingClasses.length === 0 || pendingClasses.some((item) => !roomOptions.some((room) => isRoomCompatibleWithClassType(room.type, item.classType))) || isGenerating || isSaving}
            className="rounded-md bg-[#e43a3d] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c92e33] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? 'Generating…' : 'Generate conflict-free schedule with AI'}
          </button>
          <span className="text-[11px] text-[#8b777b]">
            {pendingClasses.length} class{pendingClasses.length === 1 ? '' : 'es'} waiting to be scheduled
          </span>
          {pendingClasses.some((item) => !roomOptions.some((room) => isRoomCompatibleWithClassType(room.type, item.classType))) && (
            <p className="w-full text-[11px] text-amber-800">
              Add at least one compatible room for each class type on the <a href="/adminDashboard/rooms" className="font-semibold underline">Rooms page</a> before generating a schedule.
            </p>
          )}
        </div>
        {error && <p role="alert" className="mt-3 text-xs font-medium text-[#a52832]">{error}</p>}
        {notice && <p role="status" className="mt-3 text-xs font-medium text-[#28713b]">{notice}</p>}
      </section>

      {editing && (
        <section aria-labelledby="edit-schedule-title" className="mb-5 rounded-lg border border-[#d8abb2] bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="edit-schedule-title" className="text-sm font-semibold text-[#5d1a25]">Edit scheduled class</h2>
              <p className="mt-1 text-[11px] text-[#8b777b]">The update will be rejected if the faculty member or room is already booked.</p>
            </div>
            <button type="button" onClick={() => setEditing(null)} className="text-xs text-[#705c60] hover:underline">Cancel</button>
          </div>
          <form onSubmit={saveEdit} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Faculty member
              <select value={editFacultyId} onChange={(event) => setEditFacultyId(event.target.value)} disabled={isSaving} className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]">
                {facultyMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Class / category
              <select
                required
                value={editCategory}
                onChange={(event) => {
                  setEditCategory(event.target.value)
                  setEditCurriculumId('')
                }}
                disabled={isSaving || curriculumCategories.length === 0}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236] disabled:bg-[#f5f2f2]"
              >
                <option value="" disabled>Select class category</option>
                {curriculumCategories.map((classCategory) => (
                  <option key={classCategory} value={classCategory}>{classCategory}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Subject
              <select
                required
                value={editCurriculumId}
                onChange={(event) => setEditCurriculumId(event.target.value)}
                disabled={isSaving || editSubjectOptions.length === 0}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236] disabled:bg-[#f5f2f2]"
              >
                <option value="" disabled>
                  {editSubjectOptions.length ? 'Select subject' : 'Select a class category first'}
                </option>
                {editSubjectOptions.map((subjectOption) => (
                  <option key={subjectOption.id} value={subjectOption.id}>
                    {subjectOption.name} · {subjectOption.code || 'No code'} · {subjectOption.units ?? 'Units not recorded'} units
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Room type
              <select
                value={editClassType}
                onChange={(event) => {
                  const type = event.target.value as RoomType
                  setEditClassType(type)
                  const firstRoom = roomOptions.find((room) => isRoomCompatibleWithClassType(room.type, type))
                  if (firstRoom) setEditRoom(firstRoom.name)
                  else setEditRoom('')
                }}
                disabled={isSaving}
                className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]"
              >
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Day
              <select value={editDay} onChange={(event) => setEditDay(event.target.value as ScheduleDay)} disabled={isSaving} className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]">
                {schedulePolicy.teachingDays.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Room
              <select required value={editRoom} onChange={(event) => setEditRoom(event.target.value)} disabled={isSaving || editRoomOptions.length === 0} className="rounded-md border border-[#d9c9cc] bg-white px-3 py-2 text-xs text-[#383236]">
                <option value="" disabled>Select room</option>
                {editRoomOptions.map((room) => <option key={room.id} value={room.name}>{room.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              Start time
              <input required type="time" min={schedulePolicy.dayStartTime} max={schedulePolicy.dayEndTime} value={editStartTime} onChange={(event) => setEditStartTime(event.target.value)} disabled={isSaving} className="rounded-md border border-[#d9c9cc] px-3 py-2 text-xs text-[#383236]" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-[#705c60]">
              End time
              <input required type="time" min={schedulePolicy.dayStartTime} max={schedulePolicy.dayEndTime} value={editEndTime} onChange={(event) => setEditEndTime(event.target.value)} disabled={isSaving} className="rounded-md border border-[#d9c9cc] px-3 py-2 text-xs text-[#383236]" />
            </label>
            <div className="sm:col-span-2 xl:col-span-8">
              {error && <p role="alert" className="mb-3 text-xs font-medium text-[#a52832]">{error}</p>}
              <button type="submit" disabled={isSaving} className="rounded-md bg-[#5d1a25] px-4 py-2 text-xs font-medium text-white hover:bg-[#43121a] disabled:opacity-50">
                {isSaving ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section aria-labelledby="assignment-list-title" className="overflow-hidden rounded-lg bg-white shadow-[0_2px_5px_rgba(31,41,55,0.16)]">
        {pendingClasses.length > 0 && (
          <div className="border-b border-[#eee6e7]">
            <div className="border-b border-[#eee6e7] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#5d1a25]">Waiting for generation</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#fbf9fa] text-[#755f64]">
                    <th scope="col" className="px-4 py-3 font-medium">Subject / class</th>
                    <th scope="col" className="px-4 py-3 font-medium">Pattern / day</th>
                    <th scope="col" className="px-4 py-3 font-medium">Type</th>
                    <th scope="col" className="px-4 py-3 font-medium">Faculty member</th>
                    <th scope="col" className="px-4 py-3 font-medium">Room</th>
                    <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                    <th scope="col" className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ebec]">
                  {pendingClasses.map((classRequest) => (
                    <tr key={classRequest.id}>
                      <td className="px-4 py-3 font-medium text-[#383236]">{classRequest.subject} · {classRequest.category}</td>
                      <td className="px-4 py-3 text-[#62595c]">
                        {formatMeetingPattern(classRequest.meetingPattern)}
                        {classRequest.preferredDay ? ` · ${classRequest.preferredDay}` : ''}
                      </td>
                      <td className="px-4 py-3 text-[#62595c]">{classRequest.classType === 'lab' ? 'Lab' : 'Lecture'}</td>
                      <td className="px-4 py-3 text-[#62595c]">{classRequest.facultyName}</td>
                      <td className="px-4 py-3 text-[#62595c]">{classRequest.preferredRoom || 'Auto-pick'}</td>
                      <td className="px-4 py-3 text-[#62595c]">{formatDuration(classRequest.durationMinutes)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void removeClass(classRequest.id)} className="font-medium text-[#a52832] hover:underline">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 border-b border-[#eee6e7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="assignment-list-title" className="text-sm font-semibold text-[#5d1a25]">Generated schedule</h2>
          <p className="text-[11px] text-[#8b777b]">{assignments.length} scheduled class{assignments.length === 1 ? '' : 'es'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#eee6e7] bg-[#fbf9fa] text-[#755f64]">
                <th scope="col" className="px-4 py-3 font-medium">Day / time</th>
                <th scope="col" className="px-4 py-3 font-medium">Subject / class</th>
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 font-medium">Faculty member</th>
                <th scope="col" className="px-4 py-3 font-medium">Room</th>
                <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                <th scope="col" className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ebec]">
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-4 py-3 text-[#62595c]">
                    {assignment.day}, {formatScheduleTime(assignment.startTime)}–{formatScheduleTime(assignment.endTime)}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#383236]">
                    {assignment.subject}{assignment.category ? ` · ${assignment.category}` : ''}
                  </td>
                  <td className="px-4 py-3 text-[#62595c]">{assignment.classType === 'lab' ? 'Lab' : 'Lecture'}</td>
                  <td className="px-4 py-3 text-[#62595c]">{assignment.facultyName}</td>
                  <td className="px-4 py-3 text-[#62595c]">{assignment.room || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-[#62595c]">{formatDuration(assignment.durationMinutes)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button type="button" onClick={() => beginEdit(assignment)} className="font-medium text-[#5d1a25] hover:underline">Edit</button>
                      <button type="button" onClick={() => void removeClass(assignment.id)} className="font-medium text-[#a52832] hover:underline">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#8b777b]">
                    No schedule has been generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <section aria-labelledby="faculty-timeline-title" className="border-t border-[#eee6e7]">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="faculty-timeline-title" className="text-sm font-semibold text-[#5d1a25]">Weekly faculty schedule</h3>
              <p className="mt-0.5 text-[10px] text-[#8b777b]">
                {schedulePolicy.teachingDays.join('–')} · {formatScheduleTime(schedulePolicy.dayStartTime)}–{formatScheduleTime(schedulePolicy.dayEndTime)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#705c60]">
                <span className="sr-only sm:not-sr-only">Faculty</span>
                <select
                  aria-label="Filter weekly schedule by faculty member"
                  value={timelineFacultyFilter}
                  onChange={(event) => setTimelineFacultyFilter(event.target.value)}
                  className="rounded-lg border border-[#e7dfe1] bg-white px-2.5 py-1.5 text-xs text-[#383236]"
                >
                  <option value="all">All faculty ({facultyMembers.length})</option>
                  {facultyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>

              <div
                role="group"
                aria-label="Weekly faculty schedule zoom controls"
                className="flex w-fit items-center gap-1 rounded-lg border border-[#e7dfe1] bg-white p-1"
              >
                <button
                  type="button"
                  aria-label="Zoom out"
                  disabled={timelineZoom <= minTimelineZoom}
                  onClick={() => setTimelineZoom((current) => Math.max(minTimelineZoom, current - timelineZoomStep))}
                  className="flex h-7 w-7 items-center justify-center rounded text-base text-[#5d1a25] hover:bg-[#f6eff0] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label={`Reset zoom, currently ${timelineZoom}%`}
                  onClick={() => setTimelineZoom(100)}
                  className="min-w-12 rounded px-1 text-[10px] font-medium text-[#705c60] hover:bg-[#f6eff0]"
                >
                  {timelineZoom}%
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  disabled={timelineZoom >= maxTimelineZoom}
                  onClick={() => setTimelineZoom((current) => Math.min(maxTimelineZoom, current + timelineZoomStep))}
                  className="flex h-7 w-7 items-center justify-center rounded text-base text-[#5d1a25] hover:bg-[#f6eff0] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="px-3 pb-4 sm:px-4" style={{ minWidth: `${timelineMinWidth}px` }}>
              <div className="overflow-hidden rounded-lg border border-[#e7dfe1]">
                {/* X-axis: Days */}
                <div
                  className="grid border-b border-[#e7dfe1] bg-[#fbf9fa]"
                  style={{ gridTemplateColumns: `92px repeat(${schedulePolicy.teachingDays.length}, minmax(${timelineDayWidth}px, 1fr))` }}
                >
                  <div className="sticky left-0 z-10 flex items-center border-r border-[#e4d8da] bg-[#fbf9fa] px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-[#8b777b]">
                    Time
                  </div>
                  {schedulePolicy.teachingDays.map((day) => {
                    const dayCount = filteredTimelineAssignments.filter((assignment) => assignment.day === day).length
                    return (
                      <div key={day} className="border-l border-[#e4d8da] px-2 py-2.5 text-center">
                        <div className="text-[11px] font-semibold text-[#5d1a25]">{day}</div>
                        <div className="mt-0.5 text-[9px] text-[#8b777b]">
                          {dayCount} class{dayCount === 1 ? '' : 'es'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Y-axis: Time & Day Columns */}
                <div
                  className="relative grid"
                  style={{
                    height: `${timelineHeight}px`,
                    gridTemplateColumns: `92px repeat(${schedulePolicy.teachingDays.length}, minmax(${timelineDayWidth}px, 1fr))`,
                  }}
                >
                  <div className="sticky left-0 z-10 border-r border-[#e4d8da] bg-[#fcfafa]">
                    {timelineMarkers.map((minute) => {
                      const offsetPercent = ((minute - scheduleStartMinute) / scheduleDurationMinutes) * 100
                      return (
                        <span
                          key={minute}
                          className={`absolute inset-x-0 px-2 text-right text-[10px] font-medium text-[#76676a] ${
                            minute === scheduleStartMinute ? 'translate-y-1'
                              : minute === scheduleEndMinute ? '-translate-y-full pb-1'
                                : '-translate-y-1/2'
                          }`}
                          style={{ top: `${offsetPercent}%` }}
                        >
                          {formatScheduleTime(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`)}
                        </span>
                      )
                    })}
                  </div>

                  {schedulePolicy.teachingDays.map((day) => {
                    const dayAssignments = filteredTimelineAssignments.filter((assignment) => assignment.day === day)
                    const laidOutAssignments = layoutOverlappingEvents(dayAssignments)

                    return (
                      <div
                        key={day}
                        aria-label={`${day}, ${dayAssignments.length} classes`}
                        className="relative border-l border-[#e4d8da]"
                        style={{
                          height: `${timelineHeight}px`,
                          backgroundImage:
                            'linear-gradient(to bottom, #e0d1d4 1px, transparent 1px), linear-gradient(to bottom, #f0e9ea 1px, transparent 1px)',
                          backgroundSize: `100% ${timelineHourHeight}px, 100% ${timelineHourHeight / 2}px`,
                          backgroundRepeat: 'repeat-y, repeat-y',
                        }}
                      >
                        {laidOutAssignments.map(({ event: assignment, column, columns }) => {
                          const subjectColor = getSubjectColor(assignment.subject, assignment.classType)
                          const verticalStyle = getScheduleEventStyle(
                            assignment.startTime,
                            assignment.endTime,
                            schedulePolicy.dayStartTime,
                            schedulePolicy.dayEndTime,
                          )
                          const columnWidth = 100 / columns

                          return (
                            <div
                              key={assignment.id}
                              title={`${assignment.subject}${assignment.category ? ` · ${assignment.category}` : ''} · ${assignment.facultyName} · ${assignment.classType === 'lab' ? 'Lab' : 'Lecture'} · ${assignment.room || 'Room unassigned'} · ${formatScheduleTime(assignment.startTime)}–${formatScheduleTime(assignment.endTime)}`}
                              className={`absolute flex flex-col items-start justify-center overflow-hidden rounded-md border-y border-r border-l-4 px-2 py-1 text-[10px] font-semibold leading-tight shadow-sm ${subjectColor.border} ${subjectColor.background} ${subjectColor.text}`}
                              style={{
                                ...verticalStyle,
                                left: `calc(${column * columnWidth}% + 4px)`,
                                width: `calc(${columnWidth}% - 8px)`,
                              }}
                            >
                              <span className="w-full truncate">{assignment.subject}</span>
                              <span className="w-full truncate text-[9px] font-medium">
                                {assignment.facultyName}
                              </span>
                              <span className="w-full truncate text-[9px] font-normal">
                                {assignment.classType === 'lab' ? 'Lab' : 'Lecture'} · {assignment.room || 'Room unassigned'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </>
  )
}
