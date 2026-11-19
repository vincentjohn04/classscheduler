import { model, models, Schema } from 'mongoose'
import { roomTypes } from '@/lib/rooms'

const roomSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: roomTypes, default: 'lecture', required: true },
    normalizedName: { type: String, required: true, unique: true },
}, { timestamps: true })

export const rooms = models.Room || model('Room', roomSchema)
