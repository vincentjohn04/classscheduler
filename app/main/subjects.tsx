'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type FormEvent } from 'react'
import AccountMenu from '@/app/components/account-menu'
import AdminNavigation from '@/app/components/admin-navigation'

type SubjectsProps = {
  name: string
  email: string
  isAdmin: boolean
}

type CurriculumSubject = {
  id: string
  name: string
  code: string
  units?: number
  department: string
  category: string
}

type CurriculumResponse = {
  message?: string
  data?: CurriculumSubject[]
}

function NavigationIcon({ type }: { type: 'dashboard' | 'schedule' | 'subjects' | 'settings' }) {
  if (type === 'dashboard') {
    return <img src="/svg/dashboard_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'schedule') {
    return <img src="/svg/schedule_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  if (type === 'subjects') {
    return <img src="/svg/subject_svgrepo.com.svg" alt="" className="h-5 w-5" />
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Subjects({ name, email, isAdmin }: SubjectsProps) {
  const dashboardHref = isAdmin ? '/adminDashboard' : '/dashboard'
  const scheduleHref = isAdmin ? '/adminDashboard/schedule' : '/schedule'
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSavingManual, setIsSavingManual] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [manualUnits, setManualUnits] = useState('')
  const [manualDepartment, setManualDepartment] = useState('')
  const [manualCategory, setManualCategory] = useState('')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loadError, setLoadError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [manualMessage, setManualMessage] = useState('')
  const [manualError, setManualError] = useState('')
  const [editingSubjectId, setEditingSubjectId] = useState('')
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editUnits, setEditUnits] = useState('')
  const [editDepartment, setEditDepartment] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [removingSubjectId, setRemovingSubjectId] = useState('')
  const [subjectActionError, setSubjectActionError] = useState('')
  const [subjectActionMessage, setSubjectActionMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadSubjects() {
      try {
        const response = await fetch('/api/curriculum', { signal: controller.signal })
        const result = await response.json() as CurriculumResponse
        if (!response.ok) throw new Error(result.message || 'Curriculum subjects could not be loaded.')
        setSubjects(result.data ?? [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : 'Curriculum subjects could not be loaded.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadSubjects()
    return () => controller.abort()
  }, [])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFile) {
      setUploadError('Choose a file to scan.')
      return
    }

    setIsUploading(true)
    setUploadError('')
    setUploadMessage('')
    const form = event.currentTarget
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch('/api/curriculum', { method: 'POST', body: formData })
      const result = await response.json() as CurriculumResponse
      if (!response.ok) throw new Error(result.message || 'The curriculum file could not be scanned.')
      setSubjects(result.data ?? [])
      setUploadMessage(result.message || 'The curriculum subjects were updated.')
      setSelectedFile(null)
      form.reset()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The curriculum file could not be scanned.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleManualAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingManual(true)
    setManualError('')
    setManualMessage('')

    try {
      const response = await fetch('/api/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualName,
          code: manualCode,
          units: Number(manualUnits),
          department: manualDepartment,
          category: manualCategory,
        }),
      })
      const result = await response.json() as CurriculumResponse
      if (!response.ok) throw new Error(result.message || 'The subject could not be saved.')
      setSubjects(result.data ?? [])
      setManualMessage(result.message || 'The subject was added to the curriculum.')
      setManualName('')
      setManualCode('')
      setManualUnits('')
      setManualDepartment('')
      setManualCategory('')
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'The subject could not be saved.')
    } finally {
      setIsSavingManual(false)
    }
  }

  function startEditing(subject: CurriculumSubject) {
    setEditingSubjectId(subject.id)
    setEditName(subject.name)
    setEditCode(subject.code)
    setEditUnits(subject.units?.toString() ?? '')
    setEditDepartment(subject.department)
    setEditCategory(subject.category)
    setSubjectActionError('')
    setSubjectActionMessage('')
  }

  function cancelEditing() {
    setEditingSubjectId('')
    setSubjectActionError('')
  }

  async function saveSubjectEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingSubjectId) return

    setIsSavingEdit(true)
    setSubjectActionError('')
    setSubjectActionMessage('')
    try {
      const response = await fetch('/api/curriculum', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSubjectId,
          name: editName,
          code: editCode,
          units: Number(editUnits),
          department: editDepartment,
          category: editCategory,
        }),
      })
      const result = await response.json() as CurriculumResponse
      if (!response.ok) throw new Error(result.message || 'The subject could not be updated.')
      setSubjects(result.data ?? [])
      setEditingSubjectId('')
      setSubjectActionMessage(result.message || 'The subject was updated.')
    } catch (error) {
      setSubjectActionError(error instanceof Error ? error.message : 'The subject could not be updated.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function deleteSubject(subject: CurriculumSubject) {
    if (!window.confirm(`Delete "${subject.name}" from the curriculum?`)) return

    setRemovingSubjectId(subject.id)
    setSubjectActionError('')
    setSubjectActionMessage('')
    try {
      const response = await fetch(`/api/curriculum?id=${encodeURIComponent(subject.id)}`, { method: 'DELETE' })
      const result = await response.json() as CurriculumResponse
      if (!response.ok) throw new Error(result.message || 'The subject could not be deleted.')
      setSubjects(result.data ?? [])
      if (editingSubjectId === subject.id) setEditingSubjectId('')
      setSubjectActionMessage(result.message || 'The subject was deleted.')
    } catch (error) {
      setSubjectActionError(error instanceof Error ? error.message : 'The subject could not be deleted.')
    } finally {
      setRemovingSubjectId('')
    }
  }

  const categories = [...new Set(subjects.map((subject) => (
    subject.category || subject.department || 'Uncategorized'
  )))].sort((first, second) => first.localeCompare(second))
  const normalizedSearch = subjectSearch.trim().toLocaleLowerCase()
  const filteredSubjects = subjects.filter((subject) => {
    const category = subject.category || subject.department || 'Uncategorized'
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory
    const matchesSearch = !normalizedSearch || [
      subject.name,
      subject.code,
      subject.department,
      category,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    return matchesCategory && matchesSearch
  })
  const groupedSubjects = filteredSubjects.reduce<Record<string, CurriculumSubject[]>>((groups, subject) => {
    const category = subject.category || subject.department || 'Uncategorized'
    groups[category] ??= []
    groups[category].push(subject)
    return groups
  }, {})
  const sortedGroups = Object.entries(groupedSubjects)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([category, categorySubjects]) => [
      category,
      [...categorySubjects].sort((first, second) => first.name.localeCompare(second.name)),
    ] as const)

  return (
    <main className="min-h-screen bg-[#f7f5f4] text-[#29282b]">
      <header className="sticky top-0 z-30 h-[60px] border-b border-white/10 bg-[#5d1a25]/95 text-white shadow-sm backdrop-blur-md">
        <div className="flex h-full w-full items-center justify-between px-5 sm:px-8">
          <a href={dashboardHref} className="flex items-center gap-3" aria-label="Chronyx dashboard">
            <img src="/chronyx.png" alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-base font-bold tracking-tight">Chronyx</span>
          </a>
          <AccountMenu name={name} email={email} accountType={isAdmin ? 'Administrator' : undefined} />
        </div>
      </header>

      {isAdmin ? (
        <AdminNavigation currentPage="subjects" />
      ) : (
        <nav
          aria-label="Dashboard navigation"
          className="flex flex-wrap items-center justify-center gap-1 bg-[#5d1a25] px-2 py-2 text-white shadow-md sm:gap-3 lg:fixed lg:left-5 lg:top-1/2 lg:z-20 lg:w-56 lg:-translate-y-1/2 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-1.5 lg:rounded-2xl lg:border lg:border-white/15 lg:bg-[#5d1a25]/95 lg:px-2.5 lg:py-3 lg:shadow-[0_12px_30px_rgba(54,24,28,0.28)] lg:backdrop-blur-md"
        >
          {[
            { label: 'Dashboard', type: 'dashboard' as const, href: dashboardHref, active: false },
            { label: 'My Schedule', type: 'schedule' as const, href: scheduleHref, active: false },
            { label: 'Curriculum Subjects', type: 'subjects' as const, href: '/subjects', active: true },
            { label: 'Settings', type: 'settings' as const, href: '/settings', active: false },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 hover:bg-white/15 lg:justify-start ${
                item.active ? 'bg-[#e43a3d] text-white' : 'text-white/90'
              }`}
            >
              <NavigationIcon type={item.type} />
              <span className="whitespace-nowrap">{item.label}</span>
            </a>
          ))}
        </nav>
      )}

      <div className="mx-auto w-full max-w-[1180px] px-5 py-6 sm:px-8 sm:py-10 lg:pl-72 lg:pr-8">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d4a57]">Academic catalog</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#261d1f] sm:text-4xl">
              Curriculum Subjects
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#75656a]">
              Browse the academic catalog sorted by category.
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="mb-7 grid gap-4 md:grid-cols-2">
            <form onSubmit={handleManualAdd} className="rounded-2xl border border-[#eadde0] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[#302326]">Add a subject manually</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#796a6e]">
                Enter a subject directly into the shared curriculum.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="manual-subject-name" className="mb-1 block text-xs font-medium text-[#5b4b50]">Subject name</label>
                  <input
                    id="manual-subject-name"
                    required
                    minLength={2}
                    maxLength={150}
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    disabled={isSavingManual}
                    className="w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm outline-none focus:border-[#8d4a57] disabled:opacity-60"
                    placeholder="e.g. Introduction to Computing"
                  />
                </div>
                <div>
                  <label htmlFor="manual-subject-category" className="mb-1 block text-xs font-medium text-[#5b4b50]">Category</label>
                  <input
                    id="manual-subject-category"
                    required
                    minLength={1}
                    maxLength={100}
                    value={manualCategory}
                    onChange={(event) => setManualCategory(event.target.value)}
                    disabled={isSavingManual}
                    className="w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm outline-none focus:border-[#8d4a57] disabled:opacity-60"
                    placeholder="e.g. General Education"
                  />
                </div>
                <div>
                  <label htmlFor="manual-subject-code" className="mb-1 block text-xs font-medium text-[#5b4b50]">Subject code <span className="font-normal text-[#796a6e]">(optional)</span></label>
                  <input
                    id="manual-subject-code"
                    maxLength={40}
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value)}
                    disabled={isSavingManual}
                    className="w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm outline-none focus:border-[#8d4a57] disabled:opacity-60"
                    placeholder="e.g. CS101"
                  />
                </div>
                <div>
                  <label htmlFor="manual-subject-units" className="mb-1 block text-xs font-medium text-[#5b4b50]">Number of units</label>
                  <input
                    id="manual-subject-units"
                    required
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={manualUnits}
                    onChange={(event) => setManualUnits(event.target.value)}
                    disabled={isSavingManual}
                    className="w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm outline-none focus:border-[#8d4a57] disabled:opacity-60"
                    placeholder="e.g. 3"
                  />
                </div>
                <div>
                  <label htmlFor="manual-subject-department" className="mb-1 block text-xs font-medium text-[#5b4b50]">Department <span className="font-normal text-[#796a6e]">(optional)</span></label>
                  <input
                    id="manual-subject-department"
                    maxLength={100}
                    value={manualDepartment}
                    onChange={(event) => setManualDepartment(event.target.value)}
                    disabled={isSavingManual}
                    className="w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm outline-none focus:border-[#8d4a57] disabled:opacity-60"
                    placeholder="e.g. Computer Science"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!manualName.trim() || !manualCategory.trim() || !manualUnits || isSavingManual}
                className="mt-3 rounded-lg bg-[#5d1a25] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#48131c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingManual ? 'Saving subject…' : 'Add subject'}
              </button>
              {manualError && <p role="alert" className="mt-3 text-sm text-red-700">{manualError}</p>}
              {manualMessage && <p role="status" className="mt-3 text-sm text-green-800">{manualMessage}</p>}
            </form>

            <form onSubmit={handleUpload} className="rounded-2xl border border-[#eadde0] bg-white p-4 shadow-sm">
              <label htmlFor="curriculum-file" className="block text-sm font-semibold text-[#302326]">
                Import curriculum file
              </label>
              <p id="curriculum-file-help" className="mt-1 text-xs leading-relaxed text-[#796a6e]">
                Scan CSV, PDF, DOCX, TXT, or Markdown files (up to 10 MB).
              </p>
              <input
                id="curriculum-file"
                type="file"
                accept=".csv,.pdf,.docx,.txt,.md,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                aria-describedby="curriculum-file-help"
                disabled={isUploading}
                onChange={(event) => {
                  setSelectedFile(event.currentTarget.files?.[0] ?? null)
                  setUploadError('')
                  setUploadMessage('')
                }}
                className="mt-3 block w-full text-sm text-[#5b4b50] file:mr-3 file:rounded-lg file:border-0 file:bg-[#f8eff1] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#5d1a25] hover:file:bg-[#f1e2e5] disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="mt-3 rounded-lg bg-[#5d1a25] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#48131c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? 'Scanning file…' : 'Scan and update curriculum'}
              </button>
              {uploadError && <p role="alert" className="mt-3 text-sm text-red-700">{uploadError}</p>}
              {uploadMessage && <p role="status" className="mt-3 text-sm text-green-800">{uploadMessage}</p>}
            </form>
          </div>
        )}

        <section
          aria-label="Curriculum subjects"
          className="rounded-2xl border border-[#eadde0] bg-white p-5 shadow-[0_12px_32px_rgba(75,35,43,0.06)] sm:p-7"
        >
          {isLoading ? (
            <p className="py-12 text-center text-sm text-[#796a6e]">Loading curriculum subjects…</p>
          ) : loadError ? (
            <p role="alert" className="py-12 text-center text-sm text-red-700">{loadError}</p>
          ) : subjects.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-5 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8eff1]">
                <img src="/svg/subject_svgrepo.com.svg" alt="" className="h-7 w-7 brightness-0 opacity-60" />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-[#302326]">Your curriculum is ready to get started</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#796a6e]">
                {isAdmin
                  ? 'Add a subject manually with a category, or upload a curriculum file to scan and add subjects.'
                  : 'There are no subjects to show yet. Once an administrator adds subjects, they’ll be organized here by category.'}
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-5 flex flex-col gap-4 border-b border-[#f0e7e9] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#302326]">Browse subjects</h2>
                  <p className="mt-1 text-sm text-[#796a6e]">
                    {filteredSubjects.length} of {subjects.length} subject{subjects.length === 1 ? '' : 's'}
                    {' · '}{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <div className="grid gap-3 sm:w-[min(100%,520px)] sm:grid-cols-[minmax(0,1fr)_190px]">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-[#5b4b50]">Search catalog</span>
                    <input
                      type="search"
                      value={subjectSearch}
                      onChange={(event) => setSubjectSearch(event.target.value)}
                      placeholder="Name, code, department…"
                      className="w-full rounded-lg border border-[#e5d8db] bg-[#fffdfd] px-3 py-2.5 text-sm text-[#302326] placeholder:text-[#a79498] focus:border-[#8d4a57] focus:outline-none focus:ring-2 focus:ring-[#8d4a57]/15"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-[#5b4b50]">Category</span>
                    <select
                      value={selectedCategory}
                      onChange={(event) => setSelectedCategory(event.target.value)}
                      className="w-full rounded-lg border border-[#e5d8db] bg-[#fffdfd] px-3 py-2.5 text-sm text-[#302326] focus:border-[#8d4a57] focus:outline-none focus:ring-2 focus:ring-[#8d4a57]/15"
                    >
                      <option value="all">All categories</option>
                      {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              {sortedGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e5d8db] bg-[#fdfafb] px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-[#514a4c]">No subjects match your search</p>
                  <p className="mt-1 text-xs text-[#8b777b]">Try another name, code, department, or category.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectSearch('')
                      setSelectedCategory('all')
                    }}
                    className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold text-[#5d1a25] hover:bg-[#f7ecee]"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {subjectActionError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{subjectActionError}</p>}
                  {subjectActionMessage && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{subjectActionMessage}</p>}
                  {sortedGroups.map(([category, categorySubjects]) => (
                    <section
                      key={category}
                      aria-label={`${category} category`}
                      className="overflow-hidden rounded-xl border border-[#eee3e5] bg-white"
                    >
                      <div className="flex items-center justify-between gap-3 bg-[#fbf7f8] px-4 py-3 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1e2e5] text-[#7c3643]">
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                              <path d="M4 5.5h16M4 12h16M4 18.5h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                          </span>
                          <h3 className="truncate text-sm font-semibold text-[#4c222b]">{category}</h3>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#796a6e] ring-1 ring-[#eadde0]">
                          {categorySubjects.length} subject{categorySubjects.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <ul className="divide-y divide-[#f3edef]">
                      {categorySubjects.map((subject) => (
                        <li key={subject.id} className="px-4 py-3.5 sm:px-5">
                          {editingSubjectId === subject.id ? (
                            <form onSubmit={saveSubjectEdit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                              <label className="text-xs font-medium text-[#5b4b50] lg:col-span-2">
                                Subject name
                                <input required minLength={2} maxLength={150} value={editName} onChange={(event) => setEditName(event.target.value)} disabled={isSavingEdit} className="mt-1 w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm font-normal outline-none focus:border-[#8d4a57]" />
                              </label>
                              <label className="text-xs font-medium text-[#5b4b50]">
                                Category
                                <input required maxLength={100} value={editCategory} onChange={(event) => setEditCategory(event.target.value)} disabled={isSavingEdit} className="mt-1 w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm font-normal outline-none focus:border-[#8d4a57]" />
                              </label>
                              <label className="text-xs font-medium text-[#5b4b50]">
                                Code
                                <input maxLength={40} value={editCode} onChange={(event) => setEditCode(event.target.value)} disabled={isSavingEdit} className="mt-1 w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm font-normal outline-none focus:border-[#8d4a57]" />
                              </label>
                              <label className="text-xs font-medium text-[#5b4b50]">
                                Units
                                <input required type="number" min={1} max={100} step={1} value={editUnits} onChange={(event) => setEditUnits(event.target.value)} disabled={isSavingEdit} className="mt-1 w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm font-normal outline-none focus:border-[#8d4a57]" />
                              </label>
                              <label className="text-xs font-medium text-[#5b4b50] lg:col-span-2">
                                Department
                                <input maxLength={100} value={editDepartment} onChange={(event) => setEditDepartment(event.target.value)} disabled={isSavingEdit} className="mt-1 w-full rounded-lg border border-[#eadde0] px-3 py-2 text-sm font-normal outline-none focus:border-[#8d4a57]" />
                              </label>
                              <div className="flex items-end gap-2 lg:col-span-4">
                                <button type="submit" disabled={isSavingEdit || !editName.trim() || !editCategory.trim() || !editUnits} className="rounded-lg bg-[#5d1a25] px-3 py-2 text-xs font-semibold text-white hover:bg-[#48131c] disabled:opacity-50">
                                  {isSavingEdit ? 'Saving…' : 'Save'}
                                </button>
                                <button type="button" onClick={cancelEditing} disabled={isSavingEdit} className="rounded-lg border border-[#eadde0] px-3 py-2 text-xs font-semibold text-[#5d1a25] hover:bg-[#faf7f8] disabled:opacity-50">
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-medium text-[#302326]">{subject.name}</p>
                                {subject.department && subject.department !== category && (
                                  <p className="mt-1 text-xs text-[#8b777b]">Department: {subject.department}</p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="w-fit rounded-md bg-[#f8eff1] px-2.5 py-1 text-xs font-semibold tracking-wide text-[#6e303b]">
                                  Code: {subject.code || 'Not recorded'}
                                </span>
                                <span className="w-fit rounded-md bg-[#f3f0f1] px-2.5 py-1 text-xs font-semibold text-[#62595c]">
                                  Units: {subject.units ?? 'Not recorded'}
                                </span>
                                {isAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEditing(subject)}
                                      disabled={!!removingSubjectId}
                                      aria-label={`Edit ${subject.name}`}
                                      title={`Edit ${subject.name}`}
                                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#eadde0] text-[#5d1a25] hover:bg-[#faf7f8] disabled:opacity-50"
                                    >
                                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                                        <path d="M13.5 6.5l4 4M4 20l4.35-.75L19.1 8.5a2.12 2.12 0 0 0-3-3L5.35 16.25 4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M12.5 8.5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void deleteSubject(subject)}
                                      disabled={!!removingSubjectId}
                                      aria-label={`Delete ${subject.name}`}
                                      title={`Delete ${subject.name}`}
                                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#f0dadd] text-[#a52832] hover:bg-[#fff7f7] disabled:opacity-50"
                                    >
                                      {removingSubjectId === subject.id ? (
                                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin">
                                          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
                                          <path d="M20 12a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                      ) : (
                                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                                          <path d="M4 7h16M9 7V4h6v3M8 10v7M12 10v7M16 10v7M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
