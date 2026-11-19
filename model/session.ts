import { model, models, Schema } from 'mongoose'

const sessionSchema = new Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true })

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const sessions = models.Session || model('Session', sessionSchema)