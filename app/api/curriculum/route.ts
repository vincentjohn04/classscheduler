import { NextResponse } from 'next/server'
import * as z from 'zod'
import mongoose from 'mongoose'
import connectDb from '@/lib/mongodb'
import { getAuthenticatedUser } from '@/lib/auth'
import { createCurriculumEntry, CurriculumImportError, extractCurriculumEntries } from '@/lib/curriculum-import'
import { curriculumSubjects } from '@/model/curriculum-subject'

export const runtime = 'nodejs'

const maxFileSize = 10 * 1024 * 1024
const maxRequestSize = maxFileSize + 1024 * 1024
const manualSubjectSchema = z.object({
    name: z.string().trim().min(2).max(150),
    code: z.string().trim().max(40).optional().default(''),
    units: z.number().int().min(1).max(100),
    department: z.string().trim().max(100).optional().default(''),
    category: z.string().trim().min(1).max(100),
})

const updateSubjectSchema = manualSubjectSchema.extend({
    id: z.string().trim().min(1),
})

async function getSubjectRecords() {
    const records = await curriculumSubjects.find({})
        .select('name code units department category')
        .sort({ category: 1, name: 1 })
        .lean()

    return records.map((record) => ({
        id: record._id.toString(),
        name: record.name,
        code: record.code,
        units: record.units,
        department: record.department,
        category: record.category || record.department || 'Uncategorized',
    }))
}

async function saveEntries(entries: Awaited<ReturnType<typeof extractCurriculumEntries>>, userId: string) {
    const operations = entries.map((entry) => ({
        updateOne: {
            filter: { normalizedKey: entry.normalizedKey },
            update: {
                $set: {
                    name: entry.name,
                    code: entry.code,
                    department: entry.department,
                    category: entry.category,
                    units: entry.units,
                },
                $setOnInsert: {
                    normalizedKey: entry.normalizedKey,
                    importedBy: userId,
                },
            },
            upsert: true,
        },
    }))
    await curriculumSubjects.bulkWrite(operations, { ordered: false })

    const records = await curriculumSubjects.find({})
        .select('name code units department category')
        .sort({ category: 1, name: 1 })
        .lean()

    return records.map((record) => ({
        id: record._id.toString(),
        name: record.name,
        code: record.code,
        units: record.units,
        department: record.department,
        category: record.category || record.department || 'Uncategorized',
    }))
}

export async function GET() {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    await connectDb()
    const records = await curriculumSubjects.find({})
        .select('name code units department category')
        .sort({ category: 1, name: 1 })
        .lean()

    return NextResponse.json({
        data: records.map((record) => ({
            id: record._id.toString(),
            name: record.name,
            code: record.code,
            units: record.units,
            department: record.department,
            category: record.category || record.department || 'Uncategorized',
        })),
    })
}

export async function POST(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    if (request.headers.get('content-type')?.includes('application/json')) {
        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ message: 'Enter valid subject details.' }, { status: 400 })
        }

        const parsed = manualSubjectSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({
                message: 'Enter a subject name and category, and keep the code and department within their limits.',
            }, { status: 400 })
        }
        const entry = createCurriculumEntry(
            parsed.data.name,
            parsed.data.code,
            parsed.data.department,
            parsed.data.category,
            parsed.data.units,
        )
        if (!entry) {
            return NextResponse.json({ message: 'Enter a valid subject name, category, code, and department.' }, { status: 400 })
        }

        await connectDb()
        const data = await saveEntries([entry], currentUser.id)
        return NextResponse.json({
            message: `Added or updated “${entry.name}” in the curriculum.`,
            data,
        })
    }

    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > maxRequestSize) {
        return NextResponse.json({ message: 'Files must be 10 MB or smaller.' }, { status: 413 })
    }

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return NextResponse.json({ message: 'Upload a curriculum file to scan.' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
        return NextResponse.json({ message: 'Choose a curriculum file to scan.' }, { status: 400 })
    }
    if (!file.size) return NextResponse.json({ message: 'The selected file is empty.' }, { status: 400 })
    if (file.size > maxFileSize) {
        return NextResponse.json({ message: 'Files must be 10 MB or smaller.' }, { status: 413 })
    }

    let entries
    try {
        entries = await extractCurriculumEntries(file.name, Buffer.from(await file.arrayBuffer()))
    } catch (error) {
        if (error instanceof CurriculumImportError) {
            return NextResponse.json({ message: error.message }, { status: 422 })
        }
        console.error('Curriculum file extraction failed:', error)
        return NextResponse.json({ message: 'The curriculum file could not be scanned. Check the file and try again.' }, { status: 422 })
    }

    await connectDb()
    const data = await saveEntries(entries, currentUser.id)
    return NextResponse.json({
        message: `Scanned ${entries.length} subject${entries.length === 1 ? '' : 's'} from ${file.name}.`,
        data,
        scannedCount: entries.length,
    })
}

export async function PATCH(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ message: 'Enter valid subject details.' }, { status: 400 })
    }

    const parsed = updateSubjectSchema.safeParse(body)
    if (!parsed.success || !mongoose.isValidObjectId(parsed.data.id)) {
        return NextResponse.json({
            message: 'Enter valid subject details and a valid subject id.',
        }, { status: 400 })
    }

    const entry = createCurriculumEntry(
        parsed.data.name,
        parsed.data.code,
        parsed.data.department,
        parsed.data.category,
        parsed.data.units,
    )
    if (!entry) {
        return NextResponse.json({ message: 'Enter a valid subject name, category, code, department, and units.' }, { status: 400 })
    }

    await connectDb()
    try {
        const updated = await curriculumSubjects.findByIdAndUpdate(
            parsed.data.id,
            {
                $set: {
                    name: entry.name,
                    code: entry.code,
                    units: entry.units,
                    department: entry.department,
                    category: entry.category,
                    normalizedKey: entry.normalizedKey,
                },
            },
            { new: true, runValidators: true },
        ).lean()
        if (!updated) return NextResponse.json({ message: 'Subject not found.' }, { status: 404 })

        return NextResponse.json({
            message: `Updated “${entry.name}”.`,
            data: await getSubjectRecords(),
        })
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
            return NextResponse.json({ message: 'Another subject already uses that code or name.' }, { status: 409 })
        }
        throw error
    }
}

export async function DELETE(request: Request) {
    const currentUser = await getAuthenticatedUser()
    if (!currentUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (currentUser.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const id = new URL(request.url).searchParams.get('id')
    if (!id || !mongoose.isValidObjectId(id)) {
        return NextResponse.json({ message: 'Invalid subject id.' }, { status: 400 })
    }

    await connectDb()
    const deleted = await curriculumSubjects.findByIdAndDelete(id).select('name').lean()
    if (!deleted) return NextResponse.json({ message: 'Subject not found.' }, { status: 404 })

    return NextResponse.json({
        message: `Deleted “${deleted.name}” from the curriculum.`,
        data: await getSubjectRecords(),
    })
}
