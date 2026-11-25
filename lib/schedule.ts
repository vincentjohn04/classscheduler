import type { RoomType } from '@/lib/rooms'

export const scheduleDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export type ScheduleDay = (typeof scheduleDays)[number]

export const meetingPatterns = ['single', 'MWF', 'TTh', 'MW'] as const
export type MeetingPattern = (typeof meetingPatterns)[number]

export function getPatternDays(pattern: MeetingPattern): ScheduleDay[] {
    if (pattern === 'MWF') return ['Monday', 'Wednesday', 'Friday']
    if (pattern === 'TTh') return ['Tuesday', 'Thursday']
    if (pattern === 'MW') return ['Monday', 'Wednesday']
    return []
}

export function formatMeetingPattern(pattern?: MeetingPattern): string {
    if (pattern === 'MWF') return 'MWF (Mon·Wed·Fri)'
    if (pattern === 'TTh') return 'TTh (Tue·Thu)'
    if (pattern === 'MW') return 'MW (Mon·Wed)'
    return 'Single block'
}

export function getRecommendedSchedulePreset(
    units: number | undefined,
    classType: RoomType,
): { pattern: MeetingPattern; durationHours: string; durationMinutes: string } {
    if (classType === 'lab') {
        return { pattern: 'single', durationHours: '3', durationMinutes: '0' }
    }
    if (units === 3) {
        return { pattern: 'TTh', durationHours: '1', durationMinutes: '30' }
    }
    if (units === 2) {
        return { pattern: 'single', durationHours: '2', durationMinutes: '0' }
    }
    if (units === 1) {
        return { pattern: 'single', durationHours: '1', durationMinutes: '0' }
    }
    return { pattern: 'single', durationHours: '1', durationMinutes: '30' }
}

export type ScheduleAssignment = {
    id: string
    facultyId: string
    facultyName: string
    facultyEmail: string
    subject: string
    category?: string
    classType: RoomType
    meetingPattern?: MeetingPattern
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
    meetingPattern?: MeetingPattern
    patternGroupId?: string
    preferredDay?: ScheduleDay
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

function parseMinutes(time: string) {
    const [hour, minute] = time.split(':').map(Number)
    return hour * 60 + minute
}

export function getScheduleEventStyle(
    startTime: string,
    endTime: string,
    scheduleStartTime = '07:00',
    scheduleEndTime = '20:00',
) {
    const start = parseMinutes(startTime)
    const end = parseMinutes(endTime)
    const scheduleStart = parseMinutes(scheduleStartTime)
    const scheduleEnd = parseMinutes(scheduleEndTime)
    const scheduleDuration = Math.max(1, scheduleEnd - scheduleStart)

    const clampedStart = Math.max(scheduleStart, Math.min(start, scheduleEnd))
    const clampedEnd = Math.max(clampedStart, Math.min(end, scheduleEnd))

    return {
        top: `${((clampedStart - scheduleStart) / scheduleDuration) * 100}%`,
        height: `${((clampedEnd - clampedStart) / scheduleDuration) * 100}%`,
    }
}

export function layoutOverlappingEvents<T extends { startTime: string; endTime: string }>(
    events: T[],
): Array<{ event: T; column: number; columns: number }> {
    if (events.length === 0) return []

    const sorted = [...events].sort((a, b) => (
        parseMinutes(a.startTime) - parseMinutes(b.startTime)
        || parseMinutes(a.endTime) - parseMinutes(b.endTime)
    ))

    const results: Array<{ event: T; column: number; columns: number }> = []
    let cluster: Array<{ event: T; column: number }> = []
    let clusterColumnEnds: number[] = []
    let clusterMaxEnd = -1

    const flushCluster = () => {
        if (cluster.length === 0) return
        const totalColumns = Math.max(1, clusterColumnEnds.length)
        for (const item of cluster) {
            results.push({ event: item.event, column: item.column, columns: totalColumns })
        }
        cluster = []
        clusterColumnEnds = []
        clusterMaxEnd = -1
    }

    for (const event of sorted) {
        const start = parseMinutes(event.startTime)
        const end = Math.max(start + 15, parseMinutes(event.endTime))

        if (cluster.length > 0 && start >= clusterMaxEnd) {
            flushCluster()
        }

        let assignedColumn = clusterColumnEnds.findIndex((colEnd) => colEnd <= start)
        if (assignedColumn === -1) {
            assignedColumn = clusterColumnEnds.length
            clusterColumnEnds.push(end)
        } else {
            clusterColumnEnds[assignedColumn] = end
        }

        cluster.push({ event, column: assignedColumn })
        clusterMaxEnd = Math.max(clusterMaxEnd, end)
    }

    flushCluster()
    return results
}

export function formatScheduleTime(time: string) {
    const [hour, minute] = time.split(':').map(Number)
    const period = hour < 12 ? 'AM' : 'PM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}
