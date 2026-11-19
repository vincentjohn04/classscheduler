import { model, models, Schema } from 'mongoose'
import { scheduleDays } from '@/lib/schedule'
import { roomTypes } from '@/lib/rooms'

const scheduleRequestSchema = new Schema({
    facultyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    classType: { type: String, enum: roomTypes, default: 'lecture', required: true },
    day: { type: String, enum: scheduleDays, required: true },
    startTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule' },
}, { timestamps: true })

scheduleRequestSchema.index({ status: 1, createdAt: 1 })

export const scheduleRequests = models.ScheduleRequest
    || model('ScheduleRequest', scheduleRequestSchema)
