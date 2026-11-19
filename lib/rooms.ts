export const roomTypes = ['lecture', 'lab'] as const
export type RoomType = (typeof roomTypes)[number]

export const roomUsageTypes = ['lecture', 'lab', 'both'] as const
export type RoomUsageType = (typeof roomUsageTypes)[number]

export function normalizeRoomUsageType(value: unknown): RoomUsageType {
  if (value === 'lab' || value === 'both') return value
  return 'lecture'
}

export function isRoomCompatibleWithClassType(
  roomUsage: unknown,
  classType: RoomType,
): boolean {
  const normalized = normalizeRoomUsageType(roomUsage)
  return normalized === 'both' || normalized === classType
}

export function getCompatibleRoomFilter(classType: RoomType) {
  if (classType === 'lab') {
    return { type: { $in: ['lab', 'both'] } }
  }
  return { $or: [{ type: 'lecture' }, { type: 'both' }, { type: { $exists: false } }] }
}

export function formatRoomUsageType(value: unknown): string {
  const normalized = normalizeRoomUsageType(value)
  if (normalized === 'both') return 'Lecture & Lab'
  if (normalized === 'lab') return 'Lab'
  return 'Lecture'
}
