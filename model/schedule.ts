import { deleteModel, model, models, Schema } from 'mongoose'
import { roomTypes } from '@/lib/rooms'
import { meetingPatterns, scheduleDays } from '@/lib/schedule'

const scheduleSchema = new Schema({
    facultyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, trim: true, maxlength: 100 },
    classType: { type: String, enum: roomTypes, default: 'lecture', required: true },
    meetingPattern: { type: String, enum: meetingPatterns, default: 'single', required: true },
    patternGroupId: { type: String, trim: true, maxlength: 64 },
    preferredDay: { type: String, enum: scheduleDays },
    preferredRoom: { type: String, trim: true, maxlength: 60 },
    durationMinutes: { type: Number, required: true, min: 15, max: 780 },
    status: { type: String, enum: ['pending', 'scheduled'], default: 'pending', required: true },
    room: {
        type: String,
        trim: true,
        maxlength: 60,
        required: function (this: { status?: string }): boolean { return this.status === 'scheduled' },
    },
    day: { type: String, enum: scheduleDays, required: function () { return this.status === 'scheduled' } },
    startTime: {
        type: String,
        match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
        required: function () { return this.status === 'scheduled' },
    },
    endTime: {
        type: String,
        match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
        required: function () { return this.status === 'scheduled' },
    },
}, { timestamps: true })

scheduleSchema.index({ facultyId: 1, day: 1, status: 1, startTime: 1 })

const existingScheduleModel = models.Schedule
if (
    existingScheduleModel
    && (
        !existingScheduleModel.schema.path('meetingPattern')
        || !existingScheduleModel.schema.path('patternGroupId')
        || !existingScheduleModel.schema.path('preferredDay')
    )
) {
    deleteModel('Schedule')
}

export const schedules = models.Schedule || model('Schedule', scheduleSchema)
