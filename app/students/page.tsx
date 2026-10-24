"use client"

import {
  ArrowLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ExamIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  StudentIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import {
  Bar,
  CourseChips,
  Empty,
  Figures,
  Loading,
  SectionHead,
  clock,
  hoursMinutes,
  useCourseFilter,
  videoTitle,
  watchState,
} from "@/components/learning"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUser } from "@/hooks/use-user"
import {
  ApiError,
  QUIZ_TYPE_LABEL,
  TIER_LABEL,
  getStudent,
  listMyCourses,
  listStudents,
  type Course,
  type CourseProgress,
  type StudentDetail,
  type StudentProgress,
} from "@/lib/api"
import { cn } from "@/lib/utils"

export default function StudentsPage() {
  return (
    <AppShell roles={["instructor", "admin"]}>
      <Suspense>
        <Students />
      </Suspense>
    </AppShell>
  )
}

/** A student as the page shows them: their numbers in the chosen course, or across all of them. */
type Row = { student: StudentProgress; p: CourseProgress; lastActiveAt: string | null }

type SortKey = "name" | "progress" | "recent" | "quiet"

const SORTS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "progress", label: "Most progress" },
  { value: "recent", label: "Recently active" },
  { value: "quiet", label: "Least active" },
]

/** Students who have not done anything for this long need a nudge. */
const QUIET_DAYS = 7

function Students() {
  const user = useUser()!
  const params = useSearchParams()
  const selectedId = params.get("student")
  const [students, setStudents] = useState<StudentProgress[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("name")

  useEffect(() => {
    Promise.all([listStudents(), listMyCourses(100, 0)])
      .then(([s, c]) => {
        setStudents(s)
        // Admins also see courses they only learn in; students come from the ones they own.
        setCourses(c.filter((x) => x.instructorId === user.id))
      })
      .catch((e) => setError(errMsg(e)))
  }, [user.id])

  const [courseId, selectCourse] = useCourseFilter(courses)

  const rows = useMemo<Row[]>(() => {
    const all = (students ?? []).flatMap((s): Row[] => {
      if (!courseId) return [{ student: s, p: s.totals, lastActiveAt: s.lastActiveAt }]
      const c = s.courses.find((x) => x.courseId === courseId)
      return c ? [{ student: s, p: c, lastActiveAt: c.lastActiveAt }] : []
    })
    const q = query.trim().toLowerCase()
    const found = q
      ? all.filter(({ student: s }) => `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(q))
      : all
    return [...found].sort(SORT_FN[sort])
  }, [students, courseId, query, sort])

  const counts = useMemo(() => {
    const n: Record<string, number> = {}
    for (const s of students ?? []) for (const c of s.courses) n[c.courseId] = (n[c.courseId] ?? 0) + 1
    return n
  }, [students])

  // The detail keeps the course filter; the roster link back drops only the student.
  const hrefFor = (studentId: string | null) => {
    const next = new URLSearchParams(params)
    if (studentId) next.set("student", studentId)
    else next.delete("student")
    const qs = next.toString()
    return qs ? `/students?${qs}` : "/students"
  }

  return (
    <>
      <PageTitle title="Students" subtitle="See what each student in your courses is watching, practising and scoring." />
      <ErrorNote error={error} />
      {!students && !error && <Loading rows={4} />}

      {students && students.length === 0 && (
        <Empty
          icon={StudentIcon}
          title="No students yet"
          text="Students show up here as soon as they're enrolled in one of your courses."
        />
      )}

      {students && students.length > 0 && (
        <>
          <div className={cn("space-y-6", selectedId && "max-lg:hidden")}>
            <CourseChips courses={courses} selected={courseId} onSelect={selectCourse} counts={counts} />
            <ClassFigures rows={rows} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <Roster
              rows={rows}
              selectedId={selectedId}
              hrefFor={hrefFor}
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={setSort}
              className={cn(selectedId && "max-lg:hidden")}
            />
            {selectedId ? (
              <StudentPanel key={selectedId} studentId={selectedId} courseId={courseId} backHref={hrefFor(null)} />
            ) : (
              <NeedsAttention rows={rows} hrefFor={hrefFor} />
            )}
          </div>
        </>
      )}
    </>
  )
}

const fullName = (s: Pick<StudentProgress, "firstName" | "lastName">) => `${s.firstName} ${s.lastName}`.trim()

const initials = (s: Pick<StudentProgress, "firstName" | "lastName">) =>
  (s.firstName.charAt(0) + s.lastName.charAt(0)).toUpperCase() || "?"

const lastMs = (iso: string | null) => (iso ? Date.parse(iso) : 0)

const SORT_FN: Record<SortKey, (a: Row, b: Row) => number> = {
  name: (a, b) => fullName(a.student).localeCompare(fullName(b.student)),
  progress: (a, b) => b.p.percent - a.p.percent || fullName(a.student).localeCompare(fullName(b.student)),
  recent: (a, b) => lastMs(b.lastActiveAt) - lastMs(a.lastActiveAt),
  quiet: (a, b) => lastMs(a.lastActiveAt) - lastMs(b.lastActiveAt) || a.p.percent - b.p.percent,
}

/** Whole days since iso, or null if it never happened. */
function daysSince(iso: string | null) {
  if (!iso) return null
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
}

/** "Just now", "5m ago", "3h ago", "2d ago", then the date. */
function ago(iso: string) {
  const sec = (Date.now() - Date.parse(iso)) / 1000
  if (sec < 60) return "Just now"
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/** The class in four numbers, for whichever course is chosen. */
function ClassFigures({ rows }: { rows: Row[] }) {
  const active = rows.filter((r) => {
    const d = daysSince(r.lastActiveAt)
    return d !== null && d < QUIET_DAYS
  }).length
  const avgProgress = rows.length ? Math.round(rows.reduce((n, r) => n + r.p.percent, 0) / rows.length) : 0
  const scored = rows.map((r) => r.p.mockAvgPercent).filter((v): v is number => v !== null)
  const avgMock = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null
  return (
    <Figures
      items={[
        { label: "Students", value: rows.length },
        { label: "Active this week", value: active, of: rows.length },
        { label: "Average progress", value: `${avgProgress}%` },
        { label: "Average mock score", value: avgMock === null ? "–" : `${avgMock}%`, note: "Best attempt of each test" },
      ]}
    />
  )
}

/** The in-page sidebar: every student, searchable and sortable, each with their progress at a glance. */
function Roster({
  rows,
  selectedId,
  hrefFor,
  query,
  onQuery,
  sort,
  onSort,
  className,
}: {
  rows: Row[]
  selectedId: string | null
  hrefFor: (id: string | null) => string
  query: string
  onQuery: (q: string) => void
  sort: SortKey
  onSort: (s: SortKey) => void
  className?: string
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0 lg:sticky lg:top-20", className)}>
      <div className="space-y-2 border-b border-border p-3">
        <label className="relative block">
          <span className="sr-only">Search students</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search by name or email"
            className="bg-white pl-9"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Sort by
          <Select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} className="h-8 flex-1 text-[13px]">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No students match.</p>
      ) : (
        <ul className="divide-y divide-border lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
          {rows.map(({ student: s, p, lastActiveAt }) => {
            const current = s.id === selectedId
            return (
              <li key={s.id}>
                <Link
                  href={hrefFor(s.id)}
                  scroll={false}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 active:bg-muted",
                    current && "bg-mint/60 hover:bg-mint/60"
                  )}
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-navy text-[12px] font-medium text-white">{initials(s)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-heading">{fullName(s)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lastActiveAt ? `Active ${ago(lastActiveAt).toLowerCase()}` : "Not started yet"}
                    </p>
                  </div>
                  <div className="w-16 shrink-0 text-right">
                    <span className="tnum text-sm text-heading">{p.percent}%</span>
                    <Bar value={p.percent} className="mt-1.5" />
                  </div>
                  <CaretRightIcon className="size-4 shrink-0 text-gray-300 lg:hidden" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** With no student open: who has gone quiet, so the instructor knows where to look first. */
function NeedsAttention({ rows, hrefFor }: { rows: Row[]; hrefFor: (id: string | null) => string }) {
  const quiet = rows
    .filter((r) => {
      const d = daysSince(r.lastActiveAt)
      return d === null || d >= QUIET_DAYS
    })
    .sort(SORT_FN.quiet)
    .slice(0, 6)
  return (
    <section className="space-y-4 max-lg:hidden">
      <SectionHead title="Needs attention" aside={`No activity for ${QUIET_DAYS}+ days`} />
      {quiet.length === 0 ? (
        <Card className="flex-row items-center gap-3 px-5 py-5 text-[15px] text-heading">
          <CheckCircleIcon weight="fill" className="size-5 text-teal" />
          Everyone has been active this week.
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul className="divide-y divide-border">
            {quiet.map(({ student: s, p, lastActiveAt }) => {
              const d = daysSince(lastActiveAt)
              return (
                <li key={s.id}>
                  <Link href={hrefFor(s.id)} scroll={false} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-heading">{fullName(s)}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {d === null ? "Hasn't started anything yet" : `Inactive for ${d} days`} · {p.percent}% done
                      </p>
                    </div>
                    <CaretRightIcon className="size-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-heading" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      <p className="text-sm text-muted-foreground">Pick a student on the left to see everything they&apos;ve done.</p>
    </section>
  )
}

/** Everything one student has done in the instructor's courses (or the chosen one). */
function StudentPanel({ studentId, courseId, backHref }: { studentId: string; courseId: string | null; backHref: string }) {
  const [data, setData] = useState<StudentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStudent(studentId)
      .then(setData)
      .catch((e) =>
        setError(e instanceof ApiError && e.status === 404 ? "This student isn't enrolled in any of your courses." : errMsg(e))
      )
  }, [studentId])

  const back = (
    <Link
      href={backHref}
      scroll={false}
      className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-teal lg:hidden"
    >
      <ArrowLeftIcon className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      All students
    </Link>
  )

  if (error)
    return (
      <div className="space-y-4">
        {back}
        <ErrorNote error={error} />
      </div>
    )
  if (!data)
    return (
      <div className="space-y-4">
        {back}
        <Loading rows={5} />
      </div>
    )

  // A course filter narrows the student too, unless they are not in that course.
  const course = courseId ? data.courses.find((c) => c.courseId === courseId) : undefined
  const p: CourseProgress = course ?? data.totals
  const lastActiveAt = course ? course.lastActiveAt : data.lastActiveAt
  const cards = course ?? data
  const inScope = (id: string) => !course || id === course.courseId
  const videos = data.videos.filter((v) => inScope(v.courseId))
  const attempts = data.attempts.filter((a) => inScope(a.courseId))

  return (
    <div className="min-w-0 space-y-8">
      {back}

      <header className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="bg-gradient-to-br from-[#2a5a85] to-navy text-lg font-semibold text-white">
            {initials(data)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="display truncate text-[1.75rem] leading-tight text-heading">{fullName(data)}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {data.email} · {lastActiveAt ? `Last active ${ago(lastActiveAt).toLowerCase()}` : "Not started yet"}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {data.courses.map((c) => (
          <Badge key={c.courseId} variant={c.enrollmentStatus === "active" ? "tag" : "outline"} className="h-6 px-2.5 text-xs">
            {c.courseTitle} · {TIER_LABEL[c.tier]}
            {c.enrollmentStatus !== "active" && ` · ${c.enrollmentStatus}`}
            {c.expiresAt && ` · until ${new Date(c.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
          </Badge>
        ))}
      </div>

      <Overall p={p} />

      <Figures
        items={[
          { label: "Videos completed", value: p.videosCompleted, of: p.videosTotal },
          { label: "Time watched", value: hoursMinutes(p.watchedSec), note: "Approximate" },
          { label: "Practice tests done", value: p.practiceDone, of: p.practiceTotal },
          { label: "Mock tests taken", value: p.mockDone, of: p.mockTotal },
          { label: "Mock tests passed", value: p.mockPassed, of: p.mockDone },
          { label: "Average mock score", value: p.mockAvgPercent === null ? "–" : `${p.mockAvgPercent}%`, note: "Best attempt of each test" },
          { label: "Test attempts", value: p.quizAttempts, note: "Including retakes" },
          { label: "Flashcards reviewed", value: cards.flashcardsReviewed, of: cards.flashcardsTotal },
        ]}
      />

      {!course && data.courses.length > 1 && <ByCourse courses={data.courses} />}

      <Activity detail={{ ...data, videos, attempts }} />

      <section className="space-y-4">
        <SectionHead title="Test attempts" aside={attempts.length > 0 ? `${attempts.length}` : undefined} />
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tests submitted yet.</p>
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Test</TableHead>
                  <TableHead className="w-24">Score</TableHead>
                  <TableHead className="hidden w-28 sm:table-cell">Result</TableHead>
                  <TableHead className="hidden w-32 pr-5 md:table-cell">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-0 py-3.5 pl-5">
                      <p className="truncate text-[15px] text-heading">{a.quizTitle}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {QUIZ_TYPE_LABEL[a.quizType]} · {a.courseTitle}
                        {a.lessonTitle && ` · ${a.lessonTitle}`}
                      </p>
                    </TableCell>
                    <TableCell className="tnum text-heading">
                      {a.percent}%<span className="text-xs text-gray-400"> · {a.score}/{a.total}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {a.passed === null ? (
                        <span className="text-xs text-muted-foreground">Practice</span>
                      ) : a.passed ? (
                        <Badge variant="tag">Passed</Badge>
                      ) : (
                        <Badge variant="destructive">Not passed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden pr-5 text-xs text-muted-foreground md:table-cell">
                      <time dateTime={a.submittedAt} title={new Date(a.submittedAt).toLocaleString()}>
                        {ago(a.submittedAt)}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <SectionHead
          title="Videos watched"
          aside={p.videosTotal > videos.length ? `${p.videosTotal - videos.length} not started` : undefined}
        />
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No videos played yet.</p>
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <ul className="divide-y divide-border">
              {videos.map((v) => {
                const { state, pct } = watchState(v)
                return (
                  <li key={v.videoId} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-heading">{videoTitle(v.title)}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {v.courseTitle} · {v.lessonTitle}
                        {v.progress && ` · ${ago(v.progress.updatedAt).toLowerCase()}`}
                      </p>
                    </div>
                    <div className="w-28 shrink-0 text-right">
                      {state === "done" ? (
                        <Badge variant="tag">Finished</Badge>
                      ) : (
                        <>
                          <span className="tnum text-xs text-heading">
                            {pct !== null ? `${Math.round(pct)}%` : `at ${clock(v.progress?.positionSec ?? 0)}`}
                          </span>
                          {pct !== null && <Bar value={pct} className="mt-1.5" />}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

/** Overall percent, and a bar that shows what it is made of. */
function Overall({ p }: { p: CourseProgress }) {
  const all = p.videosTotal + p.practiceTotal + p.mockTotal
  const seg = (n: number) => (all ? (n / all) * 100 : 0)
  return (
    <section className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-10">
      <div>
        <p className="text-sm text-muted-foreground">Overall progress</p>
        <p className="display tnum mt-3 text-[4.5rem] leading-[0.8] text-heading">
          {p.percent}
          <span className="text-[2.5rem] text-gray-400">%</span>
        </p>
      </div>
      <div className="space-y-3 sm:pb-1">
        <p className="text-[15px] leading-relaxed text-gray-600">
          Finished{" "}
          <strong className="font-medium text-heading">
            {p.videosCompleted} of {p.videosTotal} videos
          </strong>{" "}
          and attempted{" "}
          <strong className="font-medium text-heading">
            {p.practiceDone + p.mockDone} of {p.practiceTotal + p.mockTotal} tests
          </strong>
          .
        </p>
        <div className="flex h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
          <div className="h-full bg-navy" style={{ width: `${seg(p.videosCompleted)}%` }} />
          <div className="h-full bg-teal" style={{ width: `${seg(p.practiceDone)}%` }} />
          <div className="h-full bg-secondary" style={{ width: `${seg(p.mockDone)}%` }} />
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-navy" /> Videos watched
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-teal" /> Practice tests
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-secondary" /> Mock tests
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-gray-200" /> Still to do
          </li>
        </ul>
      </div>
    </section>
  )
}

function ByCourse({ courses }: { courses: StudentDetail["courses"] }) {
  const cell = (done: number, total: number) => (
    <span className="tnum text-heading">
      {done}
      <span className="text-gray-400">/{total}</span>
    </span>
  )
  return (
    <section className="space-y-4">
      <SectionHead title="By course" />
      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Course</TableHead>
              <TableHead className="w-40">Progress</TableHead>
              <TableHead className="hidden w-20 lg:table-cell">Videos</TableHead>
              <TableHead className="hidden w-20 lg:table-cell">Tests</TableHead>
              <TableHead className="hidden w-24 pr-5 lg:table-cell">Avg. score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.courseId}>
                <TableCell className="max-w-0 py-4 pl-5">
                  <p className="truncate text-[15px] text-heading">{c.courseTitle}</p>
                  <p className="tnum mt-0.5 text-xs text-muted-foreground lg:hidden">
                    {c.videosCompleted}/{c.videosTotal} videos · {c.practiceDone + c.mockDone}/{c.practiceTotal + c.mockTotal} tests
                  </p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Bar value={c.percent} className="flex-1" />
                    <span className="tnum w-9 text-right text-xs text-heading">{c.percent}%</span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{cell(c.videosCompleted, c.videosTotal)}</TableCell>
                <TableCell className="hidden lg:table-cell">{cell(c.practiceDone + c.mockDone, c.practiceTotal + c.mockTotal)}</TableCell>
                <TableCell className="tnum hidden pr-5 text-heading lg:table-cell">
                  {c.mockAvgPercent === null ? "–" : `${c.mockAvgPercent}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  )
}

const ACTIVITY_LIMIT = 6

/** The latest things the student did, videos and tests merged into one timeline. */
function Activity({ detail }: { detail: Pick<StudentDetail, "videos" | "attempts"> }) {
  const events = [
    ...detail.videos
      .filter((v) => v.progress)
      .map((v) => {
        const { state, pct } = watchState(v)
        return {
          key: `v${v.videoId}`,
          at: v.progress!.updatedAt,
          icon: PlayIcon,
          text: state === "done" ? "Finished watching" : pct !== null ? `Watched ${Math.round(pct)}% of` : "Started watching",
          what: videoTitle(v.title),
          where: v.courseTitle,
        }
      }),
    ...detail.attempts.map((a) => ({
      key: `a${a.id}`,
      at: a.submittedAt,
      icon: ExamIcon,
      text: `Scored ${a.percent}% on`,
      what: a.quizTitle,
      where: `${QUIZ_TYPE_LABEL[a.quizType]}${a.passed === null ? "" : a.passed ? " · passed" : " · not passed"}`,
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, ACTIVITY_LIMIT)

  if (events.length === 0) return null
  return (
    <section className="space-y-4">
      <SectionHead title="Recent activity" />
      <Card className="gap-0 overflow-hidden py-0">
        <ol className="divide-y divide-border">
          {events.map(({ key, at, icon: EventIcon, text, what, where }) => (
            <li key={key} className="flex items-start gap-4 px-5 py-3.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-mint text-teal">
                <EventIcon weight="fill" className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-gray-600">
                  {text} <span className="text-heading">{what}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{where}</p>
              </div>
              <time dateTime={at} title={new Date(at).toLocaleString()} className="shrink-0 text-xs text-muted-foreground">
                {ago(at)}
              </time>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  )
}
