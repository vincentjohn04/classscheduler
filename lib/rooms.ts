export const roomTypes = ['lecture', 'lab'] as const
export type RoomType = (typeof roomTypes)[number]
