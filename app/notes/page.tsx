"use client"

import { ArrowRightIcon, FileTextIcon, NotePencilIcon } from "@phosphor-icons/react/dist/ssr"
import { Suspense, useEffect, useMemo, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { CourseChips, Empty, Loading, SectionHead, useCourseFilter } from "@/components/learning"
import { PdfPreview } from "@/components/pdf-preview"
import { LockHint, LockedRow } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { downloadNote, listLessons, listMyCourses, type Course, type Note } from "@/lib/api"

/** A note with where it lives, so rows can show its course and lecture. */
type LibraryNote = Note & { courseTitle: string; lessonTitle: string }

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
              (l.notes ?? []).map((n) => ({ ...n, courseTitle: c.title, lessonTitle: l.title }))
            )
          )
        )
        setCourses(cs)
        setNotes(perCourse.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [])

  const inCourse = courseId ? notes.filter((n) => n.courseId === courseId) : notes
  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () => (q ? inCourse.filter((n) => [n.title, n.description, n.lessonTitle].some((s) => s.toLowerCase().includes(q))) : inCourse),
    [inCourse, q]
  )
  const perCourse = Object.fromEntries(courses.map((c) => [c.id, notes.filter((n) => n.courseId === c.id).length]))
  const showCourse = !courseId && courses.length > 1

  return (
    <>
      <PageTitle title="Notes" subtitle="Every PDF note from your courses, in one place." />
      <ErrorNote error={error} />
      {loading && <Loading rows={4} />}

      {!loading && !error && courses.length === 0 && (
        <Empty icon={NotePencilIcon} title="No courses yet" text="Once you're enrolled in a course, its notes show up here." explore />
      )}

      {!loading && courses.length > 0 && (
        <div className="space-y-6">
          <CourseChips courses={courses} selected={courseId} onSelect={setCourseId} counts={perCourse} />
          {inCourse.length === 0 ? (
            <Empty icon={NotePencilIcon} title="No notes yet" text="Your instructor hasn't shared any notes here yet. Check back soon." />
          ) : (
            <section className="space-y-4">
              <SectionHead title="All notes" aside={<span className="tnum">{shown.length}</span>} />
              <Input
                type="search"
                aria-label="Search notes"
                placeholder="Search by title, description or lecture"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="max-w-sm"
              />
              {shown.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No notes match “{query.trim()}”.</p>
              ) : (
                <Card className="gap-0 overflow-hidden py-0">
                  <ul className="divide-y divide-border">
                    {shown.map((n) => (
                      <li key={n.id}>
                        {n.locked ? (
                          <LockedRow
                            as="div"
                            className="rounded-none border-0 px-5 py-4"
                            title={n.title}
                            meta={`${showCourse ? `${n.courseTitle} · ` : ""}${n.lessonTitle} · ${(n.sizeBytes / 1024).toFixed(0)} KB`}
                            hint={<LockHint tags={n.tiers} />}
                          />
                        ) : (
                        <button
                          type="button"
                          onClick={() => setPreview(n)}
                          className="group flex w-full touch-manipulation items-center gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors group-hover:bg-teal group-hover:text-white">
                            <FileTextIcon className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-[15px] text-heading sm:line-clamp-1">{n.title}</span>
                            <span className="tnum mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="min-w-0 truncate">
                                {showCourse && `${n.courseTitle} · `}
                                {n.lessonTitle} · {(n.sizeBytes / 1024).toFixed(0)} KB
                              </span>
                              {n.tiers.includes("free") && <Badge variant="lime">Free preview</Badge>}
                            </span>
                          </span>
                          <ArrowRightIcon className="size-4 shrink-0 text-heading/50 transition-transform duration-200 group-hover:translate-x-1" />
                        </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          )}
        </div>
      )}

      {preview && <PdfPreview title={preview.title} load={() => downloadNote(preview.id)} onClose={() => setPreview(null)} />}
    </>
  )
}
