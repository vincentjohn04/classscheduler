import { deleteModel, model, models, Schema } from 'mongoose'
import { roomUsageTypes } from '@/lib/rooms'

const roomSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: roomUsageTypes, default: 'lecture', required: true },
    normalizedName: { type: String, required: true, unique: true },
}, { timestamps: true })

const existingRoomModel = models.Room
const existingTypeEnum = existingRoomModel?.schema.path('type')?.options?.enum as
    | readonly string[]
    | undefined
if (existingRoomModel && (!Array.isArray(existingTypeEnum) || !existingTypeEnum.includes('both'))) {
    deleteModel('Room')
}

export const rooms = models.Room || model('Room', roomSchema)
