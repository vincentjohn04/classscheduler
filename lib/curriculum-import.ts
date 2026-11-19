export type CurriculumEntry = {
    name: string
    code: string
    units?: number
    department: string
    category: string
    normalizedKey: string
}

export class CurriculumImportError extends Error {}

const maxExtractedCharacters = 1_000_000
const maxSubjects = 1_000
const subjectHeaders = new Set(['name', 'subject', 'subjectname', 'course', 'coursename', 'title', 'subjecttitle', 'coursetitle'])
const codeHeaders = new Set(['code', 'coursecode', 'subjectcode', 'catalognumber'])
const unitHeaders = new Set(['unit', 'units', 'credit', 'credits', 'creditunit', 'creditunits'])
const departmentHeaders = new Set(['department', 'program', 'degreeprogram', 'college', 'faculty', 'school'])
const categoryHeaders = new Set(['category', 'subjectcategory', 'group'])
const courseCodePattern = /^[A-Z]{2,8}\s*\d{2,4}[A-Z]?$/i

function normalizeHeader(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseCsvRows(text: string) {
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let inQuotes = false

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index]
        if (character === '"') {
            if (inQuotes && text[index + 1] === '"') {
                field += '"'
                index += 1
            } else {
                inQuotes = !inQuotes
            }
        } else if (character === ',' && !inQuotes) {
            row.push(field.trim())
            field = ''
        } else if ((character === '\n' || character === '\r') && !inQuotes) {
            if (character === '\r' && text[index + 1] === '\n') index += 1
            row.push(field.trim())
            if (row.some(Boolean)) rows.push(row)
            row = []
            field = ''
        } else {
            field += character
        }
    }

    if (inQuotes) throw new CurriculumImportError('The CSV file has an unfinished quoted field.')
    row.push(field.trim())
    if (row.some(Boolean)) rows.push(row)
    return rows
}

function cleanValue(value: string) {
    return value
        .replace(/^\s*(?:[•*]\s*|-\s*|\d+[.)]\s*)/, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function makeEntry(
    nameValue: string,
    codeValue = '',
    departmentValue = '',
    categoryValue = departmentValue,
    units?: number,
): CurriculumEntry | null {
    const name = cleanValue(nameValue)
    const code = cleanValue(codeValue).toUpperCase()
    const department = cleanValue(departmentValue) || 'Uncategorized'
    const category = cleanValue(categoryValue) || department
    if (
        name.length < 2 || name.length > 150 || department.length > 100 || category.length > 100
        || code.length > 40 || (units !== undefined && (!Number.isInteger(units) || units < 1 || units > 100))
    ) return null

    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const normalizedKey = code
        ? `code:${code.replace(/\s+/g, '')}`
        : `name:${department.toLowerCase()}:${normalizedName}`
    return { name, code, units, department, category, normalizedKey }
}

export function createCurriculumEntry(name: string, code = '', department = '', category = '', units?: number) {
    return makeEntry(name, code, department, category || department, units)
}

function parseUnits(value: string) {
    if (!value.trim()) return undefined
    const units = Number(value.trim())
    if (!Number.isInteger(units) || units < 1 || units > 100) {
        throw new CurriculumImportError('Subject units must be a whole number from 1 to 100.')
    }
    return units
}

function collectUniqueEntries(entries: Array<CurriculumEntry | null>) {
    const unique = new Map<string, CurriculumEntry>()
    for (const entry of entries) {
        if (entry) unique.set(entry.normalizedKey, entry)
        if (unique.size > maxSubjects) {
            throw new CurriculumImportError(`The file contains more than ${maxSubjects} subjects. Split it into smaller files.`)
        }
    }
    if (!unique.size) {
        throw new CurriculumImportError('No subject records were found. Include a subject/course name, or list subjects under a “Subjects” heading.')
    }
    return [...unique.values()]
}

function parseCsv(text: string) {
    const rows = parseCsvRows(text.replace(/^\uFEFF/, ''))
    if (!rows.length) throw new CurriculumImportError('The CSV file is empty.')

    const headerIndex = rows.findIndex((row) => row.some((value) => (
        subjectHeaders.has(normalizeHeader(value))
        || codeHeaders.has(normalizeHeader(value))
        || unitHeaders.has(normalizeHeader(value))
        || departmentHeaders.has(normalizeHeader(value))
        || categoryHeaders.has(normalizeHeader(value))
    )))

    if (headerIndex >= 0) {
        const headers = rows[headerIndex].map(normalizeHeader)
        const nameIndex = headers.findIndex((header) => subjectHeaders.has(header))
        const codeIndex = headers.findIndex((header) => codeHeaders.has(header))
        const unitsIndex = headers.findIndex((header) => unitHeaders.has(header))
        const departmentIndex = headers.findIndex((header) => departmentHeaders.has(header))
        const categoryIndex = headers.findIndex((header) => categoryHeaders.has(header))
        if (nameIndex < 0) {
            throw new CurriculumImportError('Add a column named Subject, Subject Name, Course, Course Name, or Title.')
        }
        return collectUniqueEntries(rows.slice(headerIndex + 1).map((row) => makeEntry(
            row[nameIndex] ?? '',
            codeIndex >= 0 ? row[codeIndex] ?? '' : '',
            departmentIndex >= 0 ? row[departmentIndex] ?? '' : '',
            categoryIndex >= 0
                ? row[categoryIndex] ?? ''
                : departmentIndex >= 0 ? row[departmentIndex] ?? '' : '',
            unitsIndex >= 0 ? parseUnits(row[unitsIndex] ?? '') : undefined,
        )))
    }

    return collectUniqueEntries(rows.map((row) => {
        const firstIsCode = courseCodePattern.test(row[0] ?? '')
        const secondIsCode = courseCodePattern.test(row[1] ?? '')
        if (firstIsCode) return makeEntry(row[1] ?? '', row[0], row[2] ?? '')
        if (secondIsCode) return makeEntry(row[0], row[1], row[2] ?? '')
        return makeEntry(row[0] ?? '', '', row[1] ?? '')
    }))
}

function parseDocumentText(text: string) {
    if (text.length > maxExtractedCharacters) {
        throw new CurriculumImportError('This document contains too much text to scan. Please split it into smaller files.')
    }

    const entries: Array<CurriculumEntry | null> = []
    const lines = text.split(/\r?\n/)
    let inSubjectsSection = false
    let currentDepartment = ''

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        const departmentMatch = line.match(/^(?:department|program|college|faculty|school)\s*[:\-]\s*(.+)$/i)
        if (departmentMatch) {
            currentDepartment = departmentMatch[1].trim()
            continue
        }
        if (/^(?:curriculum\s+)?(?:subjects?|courses?)(?:\s+offered)?\s*:?$/i.test(line)) {
            inSubjectsSection = true
            continue
        }
        if (/^(?:subject|course)\s+(?:code|name|title)|^(?:code|catalog)\s+(?:subject|course)/i.test(line)) continue

        const leadingCode = line.match(/^([A-Z]{2,8}\s*\d{2,4}[A-Z]?)\s*(?:[-:|–—]\s*|\s+)(.{2,150})$/i)
        if (leadingCode) {
            const unitsMatch = leadingCode[2].match(/^(.*?)\s*\((\d{1,3})\s*(?:units?|credits?)\)$/i)
            entries.push(makeEntry(
                unitsMatch?.[1] || leadingCode[2],
                leadingCode[1],
                currentDepartment,
                currentDepartment,
                unitsMatch ? parseUnits(unitsMatch[2]) : undefined,
            ))
            continue
        }

        const trailingCode = line.match(/^(.{2,150}?)\s*[\[(]\s*([A-Z]{2,8}\s*\d{2,4}[A-Z]?)\s*[\])]$/i)
        if (trailingCode) {
            entries.push(makeEntry(trailingCode[1], trailingCode[2], currentDepartment))
            continue
        }

        const bullet = line.match(/^(?:[•*-]|\d+[.)])\s*(.{2,150})$/)
        if (inSubjectsSection && bullet) entries.push(makeEntry(bullet[1], '', currentDepartment))
    }

    return collectUniqueEntries(entries)
}

async function extractText(extension: string, buffer: Buffer) {
    if (extension === '.csv' || extension === '.txt' || extension === '.md') {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
        } catch {
            throw new CurriculumImportError('This file must use UTF-8 text encoding.')
        }
    }

    if (extension === '.docx') {
        try {
            const { default: mammoth } = await import('mammoth')
            const result = await mammoth.extractRawText({ buffer })
            return result.value
        } catch {
            throw new CurriculumImportError('We could not read this Word document. Check that the DOCX file is not damaged.')
        }
    }

    if (extension === '.pdf') {
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: buffer })
        try {
            const result = await parser.getText()
            return result.text
        } catch {
            throw new CurriculumImportError('We could not read this PDF. It may be damaged, password-protected, or image-only.')
        } finally {
            await parser.destroy()
        }
    }

    throw new CurriculumImportError('Supported file types are CSV, PDF, DOCX, TXT, and Markdown (.md).')
}

export async function extractCurriculumEntries(fileName: string, buffer: Buffer) {
    const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
    const text = await extractText(extension, buffer)
    if (text.length > maxExtractedCharacters) {
        throw new CurriculumImportError('This document contains too much text to scan. Please split it into smaller files.')
    }
    if (extension === '.csv') return parseCsv(text)
    return parseDocumentText(text)
}
