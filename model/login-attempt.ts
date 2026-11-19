import { deleteModel, model, models, Schema } from 'mongoose'

const otpSchema = new Schema({
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, required: true },
}, { _id: false })

const loginAttemptSchema = new Schema({
    email: { type: String, required: true, unique: true },
    failedAttempts: { type: Number, required: true, default: 0 },
    otp: { type: otpSchema, required: false },
    reaccessRequestedAt: { type: Date, required: false },
    reaccessReason: { type: String, required: false },
    expiresAt: { type: Date, required: true },
}, { timestamps: true })

loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const existingLoginAttemptModel = models.LoginAttempt
if (
    existingLoginAttemptModel
    && (
        !existingLoginAttemptModel.schema.path('otp')
        || !existingLoginAttemptModel.schema.path('reaccessRequestedAt')
        || !existingLoginAttemptModel.schema.path('reaccessReason')
    )
) {
    deleteModel('LoginAttempt')
}

export const loginAttempts = models.LoginAttempt || model('LoginAttempt', loginAttemptSchema)
