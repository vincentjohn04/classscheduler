import { model, models, Schema } from 'mongoose'

const reaccessRequestSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    userName: { type: String, required: false },
    userRole: { type: String, required: false },
    failedAttempts: { type: Number, required: true, default: 3 },
    reason: { type: String, required: false },
    status: { type: String, enum: ['pending', 'approved'], default: 'pending', required: true },
    requestedAt: { type: Date, required: true, default: () => new Date() },
    approvedAt: { type: Date, required: false },
    approvedBy: { type: String, required: false },
  },
  { timestamps: true },
)

export const reaccessRequests =
  models.ReaccessRequest || model('ReaccessRequest', reaccessRequestSchema)
