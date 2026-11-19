import { model, models, Schema } from 'mongoose'

const curriculumSubjectSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, trim: true, maxlength: 40, default: '' },
    units: { type: Number, min: 1, max: 100 },
    department: { type: String, required: true, trim: true, maxlength: 100, default: 'Uncategorized' },
    category: { type: String, required: true, trim: true, maxlength: 100, default: 'Uncategorized' },
    normalizedKey: { type: String, required: true, unique: true },
    importedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

curriculumSubjectSchema.index({ department: 1, name: 1 })
curriculumSubjectSchema.index({ category: 1, name: 1 })

export const curriculumSubjects = models.CurriculumSubject
    || model('CurriculumSubject', curriculumSubjectSchema)
