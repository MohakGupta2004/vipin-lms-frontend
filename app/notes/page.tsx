"use client"

import {
  CaretDownIcon,
  CaretRightIcon,
  FilePdfIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { CourseChips, Empty, Loading, useCourseFilter } from "@/components/learning"
import { PdfPreview } from "@/components/pdf-preview"
import { LockHint, LockedRow } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadNote, listLessons, listMyCourses, type Course, type Note } from "@/lib/api"

/** A note with where it lives, so rows can show its lecture and the list can keep course order. */
type LibraryNote = Note & { courseTitle: string; lessonTitle: string; lessonPos: number }

const ALL = "all"
const plural = (n: number) => `${n} ${n === 1 ? "note" : "notes"}`
// "Chapter 2" before "Chapter 10": numbers inside titles compare as numbers.
const byTitle = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export default function NotesPage() {
  return (
    <AppShell roles={["student"]}>
      <Suspense>
        <Notes />
      </Suspense>
    </AppShell>
  )
}

function Notes() {
  const [courses, setCourses] = useState<Course[]>([])
  const [notes, setNotes] = useState<LibraryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [preview, setPreview] = useState<Note | null>(null)
  const [courseId, setCourseId] = useCourseFilter(courses)

  useEffect(() => {
    // There is no "all my notes" endpoint: gather them from each enrolled course's lessons.
    listMyCourses(100, 0)
      .then(async (cs) => {
        const perCourse = await Promise.all(
          cs.map(async (c) =>
            (await listLessons(c.id)).flatMap((l) =>
              (l.notes ?? []).map((n) => ({ ...n, courseTitle: c.title, lessonTitle: l.title, lessonPos: l.position }))
            )
          )
        )
        setCourses(cs)
        // Study order, the way the course runs: by lecture, then chapter by chapter within it.
        setNotes(perCourse.flat().sort((a, b) => a.lessonPos - b.lessonPos || byTitle.compare(a.title, b.title)))
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [])

  const inCourse = courseId ? notes.filter((n) => n.courseId === courseId) : notes
  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      q
        ? inCourse.filter((n) =>
            [n.title, n.description, n.lessonTitle, n.courseTitle].some((s) => s.toLowerCase().includes(q))
          )
        : inCourse,
    [inCourse, q]
  )
  const perCourse = Object.fromEntries(courses.map((c) => [c.id, notes.filter((n) => n.courseId === c.id).length]))
  // Across all courses the list falls into one group per course, headed by its name, so rows needn't repeat it.
  const groups = courses
    .map((c) => ({ course: c, items: shown.filter((n) => n.courseId === c.id) }))
    .filter((g) => g.items.length > 0)
  const grouped = !courseId && groups.length > 1

  return (
    <>
      <PageTitle title="Notes" subtitle="Every PDF note from your courses, in one place." />
      <ErrorNote error={error} />
      {loading && <Loading rows={4} />}

      {!loading && !error && courses.length === 0 && (
        <Empty icon={NotePencilIcon} title="No courses yet" text="Once you're enrolled in a course, its notes show up here." explore />
      )}

      {!loading && courses.length > 0 && (
        <div className="space-y-5 sm:space-y-6">
          {notes.length > 0 && <SearchField value={query} onChange={setQuery} />}

          {/* Phones: one pull-down that names the scope; wider screens have room for every course as a chip. */}
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <CourseMenu courses={courses} selected={courseId} onSelect={setCourseId} counts={perCourse} />
            <span className="tnum shrink-0 text-[13px] text-muted-foreground">{plural(shown.length)}</span>
          </div>
          <div className="hidden sm:block">
            <CourseChips courses={courses} selected={courseId} onSelect={setCourseId} counts={perCourse} />
          </div>

          {inCourse.length === 0 ? (
            <Empty icon={NotePencilIcon} title="No notes yet" text="Your instructor hasn't shared any notes here yet. Check back soon." />
          ) : shown.length === 0 ? (
            <div className="rise flex flex-col items-center gap-3 py-12 text-center">
              <MagnifyingGlassIcon className="size-8 text-heading/25" />
              <p className="text-[15px] text-heading">No results for “{query.trim()}”</p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="min-h-11 rounded-full px-4 text-[15px] font-medium text-teal transition-opacity active:opacity-60"
              >
                Clear search
              </button>
            </div>
          ) : grouped ? (
            groups.map((g) => (
              <NoteGroup key={g.course.id} title={g.course.title} count={g.items.length} notes={g.items} onOpen={setPreview} />
            ))
          ) : (
            <NoteGroup notes={shown} onOpen={setPreview} />
          )}
        </div>
      )}

      {preview && <PdfPreview title={preview.title} load={() => downloadNote(preview.id)} onClose={() => setPreview(null)} />}
    </>
  )
}

/** iOS-style search: a filled field with the magnifier inside and a clear button once there's text. */
function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative sm:max-w-sm">
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-heading/40" />
      <input
        ref={ref}
        type="search"
        aria-label="Search notes"
        placeholder="Search notes"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        // 16px text keeps iOS from zooming the page on focus.
        className="h-11 w-full rounded-xl bg-[rgba(118,118,128,0.12)] pr-10 pl-10 text-[16px] text-heading outline-none transition-shadow placeholder:text-heading/40 focus-visible:ring-2 focus-visible:ring-teal/40 sm:h-10 sm:text-[15px] [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("")
            ref.current?.focus()
          }}
          className="absolute top-0 right-0 flex size-11 items-center justify-center text-heading/35 transition-opacity active:opacity-60 sm:size-10"
        >
          <XCircleIcon weight="fill" className="size-[18px]" />
        </button>
      )}
    </div>
  )
}

/**
 * The course scope as a pull-down button: it says what is shown, and opens from itself into the full list
 * of courses with their counts. Courses without notes are left out; there is nothing to see there.
 */
function CourseMenu({
  courses,
  selected,
  onSelect,
  counts,
}: {
  courses: Course[]
  selected: string | null
  onSelect: (courseId: string | null) => void
  counts: Record<string, number>
}) {
  if (courses.length < 2) return <span />
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const options = courses.filter((c) => counts[c.id] > 0 || c.id === selected)
  const current = courses.find((c) => c.id === selected)
  const item = "min-h-11 gap-3 rounded-xl py-2 pr-9 pl-3 text-[15px] text-heading"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-full bg-white py-2 pr-3 pl-4 text-[15px] font-semibold text-heading shadow-[0_1px_2px_rgba(16,42,67,0.06),0_0_0_0.5px_rgba(16,42,67,0.08)] transition-transform duration-150 ease-(--ease-out) active:scale-[0.97] data-popup-open:bg-gray-50"
          />
        }
      >
        <span className="truncate">{current?.title ?? "All courses"}</span>
        <CaretDownIcon weight="bold" className="size-3.5 shrink-0 text-heading/45" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-1.5">
        <DropdownMenuRadioGroup value={selected ?? ALL} onValueChange={(v: string) => onSelect(v === ALL ? null : v)}>
          <DropdownMenuRadioItem value={ALL} className={item}>
            <span className="flex-1 font-medium">All courses</span>
            <span className="tnum text-[13px] text-muted-foreground">{total}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator className="my-1" />
          {options.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id} className={item}>
              <span className="line-clamp-2 flex-1 leading-snug">{c.title}</span>
              <span className="tnum text-[13px] text-muted-foreground">{counts[c.id]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** An inset grouped list, as in iOS Settings: an optional header, then rows on one rounded card. */
function NoteGroup({
  title,
  count,
  notes,
  onOpen,
}: {
  title?: string
  count?: number
  notes: LibraryNote[]
  onOpen: (n: Note) => void
}) {
  return (
    <section className="space-y-2">
      {title && (
        <h2 className="flex items-baseline gap-3 px-1 text-[13px] font-semibold text-heading/55">
          <span className="line-clamp-1 flex-1">{title}</span>
          <span className="tnum shrink-0 font-normal">{count}</span>
        </h2>
      )}
      <ul className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(16,42,67,0.05),0_0_0_0.5px_rgba(16,42,67,0.06)]">
        {notes.map((n, i) => (
          <li key={n.id} className="relative">
            {/* Dividers start at the text, not the edge, so each row's icon stands on its own. */}
            {i > 0 && <span aria-hidden="true" className="absolute top-0 right-0 left-[4.25rem] h-px bg-border" />}
            {n.locked ? (
              <LockedRow
                as="div"
                className="rounded-none border-0 bg-transparent px-4 py-3"
                title={n.title}
                meta={`${n.lessonTitle} · ${kb(n.sizeBytes)}`}
                hint={<LockHint tags={n.tiers} />}
              />
            ) : (
              <button
                type="button"
                onClick={() => onOpen(n)}
                className="group flex min-h-16 w-full touch-manipulation items-center gap-3.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-black/[0.02] active:bg-black/[0.05]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-teal/10 text-teal">
                  <FilePdfIcon weight="duotone" className="size-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] leading-snug font-medium text-heading">{n.title}</span>
                  <span className="tnum mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground">
                    <span className="min-w-0 truncate">{n.lessonTitle}</span>
                    {n.tiers.includes("free") && <Badge variant="lime">Free</Badge>}
                  </span>
                </span>
                <CaretRightIcon
                  weight="bold"
                  className="size-3.5 shrink-0 text-heading/25 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`
