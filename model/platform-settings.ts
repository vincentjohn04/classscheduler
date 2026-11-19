import { model, models, Schema } from 'mongoose'
import { scheduleDays } from '@/lib/schedule'

const platformSettingsSchema = new Schema({
    key: { type: String, required: true, unique: true, default: 'global' },
    academicTerm: {
        type: String,
        enum: ['First Semester', 'Second Semester', 'Summer'],
        required: true,
        default: 'First Semester',
    },
    academicYear: { type: Number, required: true, min: 2000, max: 2100, default: 2026 },
    teachingDays: {
        type: [{ type: String, enum: scheduleDays }],
        required: true,
        default: [...scheduleDays],
        validate: { validator: (days: string[]) => days.length > 0, message: 'Select at least one teaching day.' },
    },
    dayStartTime: {
        type: String,
        required: true,
        match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
        default: '07:00',
    },
    dayEndTime: {
        type: String,
        required: true,
        match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
        default: '20:00',
    },
}, { timestamps: true })

export const platformSettings = models.PlatformSettings
    || model('PlatformSettings', platformSettingsSchema)
