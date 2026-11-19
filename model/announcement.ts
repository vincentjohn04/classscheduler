import { model, models, Schema } from 'mongoose'

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    createdBy: { type: String, required: true, trim: true, maxlength: 80 },
    createdByEmail: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true },
)

export const announcements =
  models.Announcement || model('Announcement', announcementSchema)
