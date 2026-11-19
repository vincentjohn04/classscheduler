import type { RoomType } from '@/lib/rooms'

export const scheduleDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export type ScheduleDay = (typeof scheduleDays)[number]

export type ScheduleAssignment = {
    id: string
    facultyId: string
    facultyName: string
    facultyEmail: string
    subject: string
    category?: string
    classType: RoomType
    room: string
    day: ScheduleDay
    startTime: string
    endTime: string
    durationMinutes: number
}

export type ScheduleClassRequest = {
    id: string
    facultyId: string
    facultyName: string
    facultyEmail: string
    subject: string
    category: string
    classType: RoomType
    preferredRoom?: string
    durationMinutes: number
}

export type SchedulePreferenceRequest = {
    id: string
    facultyId: string
    facultyName: string
    facultyEmail: string
    subject: string
    category?: string
    classType: RoomType
    day: ScheduleDay
    startTime: string
    endTime: string
    status: 'pending' | 'approved' | 'rejected'
    createdAt: string | null
}

export function isScheduleDay(value: string | undefined): value is ScheduleDay {
    return scheduleDays.some((day) => day === value)
}

export function getScheduleEventStyle(
    startTime: string,
    endTime: string,
    scheduleStartTime = '07:00',
    scheduleEndTime = '20:00',
) {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const start = startHour * 60 + startMinute
    const end = endHour * 60 + endMinute
    const [scheduleStartHour, scheduleStartMinute] = scheduleStartTime.split(':').map(Number)
    const [scheduleEndHour, scheduleEndMinute] = scheduleEndTime.split(':').map(Number)
    const scheduleStart = scheduleStartHour * 60 + scheduleStartMinute
    const scheduleDuration = scheduleEndHour * 60 + scheduleEndMinute - scheduleStart

    return {
        left: `${((start - scheduleStart) / scheduleDuration) * 100}%`,
        width: `${((end - start) / scheduleDuration) * 100}%`,
    }
}

export function formatScheduleTime(time: string) {
    const [hour, minute] = time.split(':').map(Number)
    const period = hour < 12 ? 'AM' : 'PM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}
