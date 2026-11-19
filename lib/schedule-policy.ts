import { platformSettings } from '@/model/platform-settings'
import { scheduleDays, type ScheduleDay } from '@/lib/schedule'

export const defaultSchedulePolicy = {
  teachingDays: [...scheduleDays],
  dayStartTime: '07:00',
  dayEndTime: '20:00',
} as const

export type SchedulePolicy = {
  teachingDays: ScheduleDay[]
  dayStartTime: string
  dayEndTime: string
}

export async function getSchedulePolicy(): Promise<SchedulePolicy> {
  const settings = await platformSettings.findOne({ key: 'global' })
    .select('teachingDays dayStartTime dayEndTime')
    .lean()

  return {
    teachingDays: settings?.teachingDays ?? [...defaultSchedulePolicy.teachingDays],
    dayStartTime: settings?.dayStartTime ?? defaultSchedulePolicy.dayStartTime,
    dayEndTime: settings?.dayEndTime ?? defaultSchedulePolicy.dayEndTime,
  }
}

export function getTimeMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}
