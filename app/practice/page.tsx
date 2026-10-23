"use client"

import { CaretDownIcon, CaretRightIcon, CheckIcon, CheckCircleIcon, ListChecksIcon, LockIcon, TimerIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { CourseChips, Empty, Loading, Segmented, useCourseFilter } from "@/components/learning"
import { QUIZ_TYPE_PLURAL, listMyCourses, listMyQuizzes, type Course, type MyQuiz, type QuizType } from "@/lib/api"
import { LockHint } from "@/components/tier-badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Icon } from "@phosphor-icons/react"

export default function PracticeAndPreparePage() {
  return (
    <AppShell>
      <Suspense>
        <PracticeAndPrepare />
      </Suspense>
    </AppShell>
  )
}

function PracticeAndPrepare() {
  const [courses, setCourses] = useState<Course[]>([])
  const [quizzes, setQuizzes] = useState<MyQuiz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestedType = useSearchParams().get("type")
  const [type, setType] = useState<QuizType | null>(
    requestedType === "mock_test" || requestedType === "practice" ? requestedType : null
  )
  const [courseId, setCourseId] = useCourseFilter(courses)

  useEffect(() => {
    Promise.all([listMyCourses(100, 0), listMyQuizzes()])
      .then(([c, q]) => {
        setCourses(c)
        setQuizzes(q)
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [])

  const inCourse = courseId ? quizzes.filter((q) => q.courseId === courseId) : quizzes
  const practice = inCourse.filter((q) => q.type === "practice")
  const mock = inCourse.filter((q) => q.type === "mock_test")
  // Until the user picks a tab, open the one that has something in it.
  const tab: QuizType = type ?? (practice.length === 0 && mock.length > 0 ? "mock_test" : "practice")
  const shown = tab === "practice" ? practice : mock
  const done = shown.filter((q) => q.attemptCount > 0).length
  const perCourse = Object.fromEntries(courses.map((c) => [c.id, quizzes.filter((q) => q.courseId === c.id).length]))
  const isMock = tab === "mock_test"

  return (
    <>
      <PageTitle
        title="Practice & Prepare"
        subtitle="Strengthen your understanding with practice tests, study materials and assessments."
      />
      <ErrorNote error={error} />
      {loading && <Loading rows={5} />}

      {!loading && !error && courses.length === 0 && (
        <Empty icon={ListChecksIcon} title="No courses yet" text="Once you're enrolled in a course, its practice tests and mock tests show up here." explore />
      )}

      {!loading && courses.length > 0 && (
        <>
          {/* Phones: the scrolling chips. Larger screens: a segmented control with the full course names. */}
          <CourseRow courses={courses} quizzes={quizzes} selected={courseId} onSelect={setCourseId} />
          {courses.length > 4 && (
            <div className="hidden md:block">
              <CourseChips courses={courses} selected={courseId} onSelect={setCourseId} counts={perCourse} />
            </div>
          )}
          {courses.length > 1 && courses.length <= 4 && (
            <CourseSegments courses={courses} selected={courseId} onSelect={setCourseId} counts={perCourse} />
          )}

          <div className="space-y-6">
            {/* Phones: the shared full-width segmented control. Larger screens: a compact one in a toolbar row. */}
            <div className="md:hidden">
              <Segmented<QuizType>
                label="Test type"
                value={tab}
                onChange={setType}
                options={[
                  { value: "practice", label: QUIZ_TYPE_PLURAL.practice, count: practice.length },
                  { value: "mock_test", label: QUIZ_TYPE_PLURAL.mock_test, count: mock.length },
                ]}
              />
            </div>

            <div className="space-y-3">
              <div className="hidden items-center justify-between gap-6 md:flex">
                <TypeSegments
                  value={tab}
                  onChange={setType}
                  options={[
                    { value: "practice", label: QUIZ_TYPE_PLURAL.practice, icon: ListChecksIcon, count: practice.length },
                    { value: "mock_test", label: QUIZ_TYPE_PLURAL.mock_test, icon: TimerIcon, count: mock.length },
                  ]}
                />
                {shown.length > 0 && (
                  <p className="tnum ml-auto shrink-0 text-sm text-muted-foreground">
                    <span className="font-semibold text-heading">{done}</span> of {shown.length} {isMock ? "taken" : "practised"}
                  </p>
                )}
              </div>
              <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
                {shown.length > 0 && (
                  <span className="tnum md:hidden">
                    <span className="font-semibold text-heading">{done}</span> of {shown.length} {isMock ? "taken" : "practised"}.{" "}
                  </span>
                )}
                {isMock
                  ? "Timed and scored like the real exam. You see your marks, not the answers."
                  : "Untimed and unmarked. Each answer and its explanation shows as soon as you pick it."}
              </p>
            </div>

            {shown.length === 0 ? (
              <Empty
                icon={ListChecksIcon}
                title={`No ${QUIZ_TYPE_PLURAL[tab].toLowerCase()} yet`}
                text="Your instructor hasn't published any here yet. Check back soon."
              />
            ) : (
              // All courses: an inset group per course, like iOS Settings. One course: a single group.
              <div className="space-y-8">
                {(!courseId && courses.length > 1
                  ? courses.map((c) => ({ id: c.id, title: c.title as string | null, items: shown.filter((q) => q.courseId === c.id) }))
                  : [{ id: "all", title: null, items: shown }]
                )
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <section key={g.id} aria-label={g.title ?? undefined}>
                      {g.title && (
                        <div className="mb-2 flex items-baseline justify-between gap-4 px-4">
                          <h2 className="truncate text-[13px] font-medium text-gray-500">{g.title}</h2>
                          <span className="tnum shrink-0 text-[13px] text-gray-400">
                            {g.items.filter((q) => q.attemptCount > 0).length} of {g.items.length}
                          </span>
                        </div>
                      )}
                      <ul className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(10,37,64,0.07),0_1px_2px_rgba(10,37,64,0.04),0_8px_24px_-12px_rgba(10,37,64,0.10)]">
                        {g.items.map((q) => (
                          <QuizRow key={q.id} quiz={q} />
                        ))}
                      </ul>
                    </section>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

function QuizRow({ quiz: q }: { quiz: MyQuiz }) {
  const isMock = q.type === "mock_test"
  const tried = q.attemptCount > 0
  const time = isMock ? (q.timeLimitSec ? `${Math.round(q.timeLimitSec / 60) || 1} min` : "Untimed") : "Self-paced"
  const meta = [q.lessonTitle, `${q.questionCount} questions`, time, isMock && q.passPercent !== null ? `Pass ${q.passPercent}%` : null]
    .filter(Boolean)
    .join(" · ")

  const status = q.locked ? (
    <LockHint tags={q.tiers} />
  ) : !tried ? (
    <span className="text-[15px] text-gray-400">Not started</span>
  ) : isMock ? (
    <span className="flex items-baseline gap-2">
      <span className="tnum text-[17px] font-semibold tracking-[-0.01em] text-heading">{q.bestPercent ?? 0}%</span>
      <span className={cn("text-[13px]", q.passed ? "text-teal" : "text-gray-500")}>{q.passed ? "Passed" : "Below pass"}</span>
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-[15px] text-teal">
      <CheckCircleIcon weight="fill" className="size-[18px]" />
      {q.attemptCount === 1 ? "Done" : `Done ${q.attemptCount}×`}
    </span>
  )

  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-2 text-[17px] leading-snug tracking-[-0.01em]", q.locked ? "text-gray-500" : "text-heading")}>
          {q.locked && <LockIcon className="size-4 shrink-0" aria-label="Locked" />}
          <span className="line-clamp-2 sm:truncate">{q.title}</span>
        </span>
        <span className="tnum mt-0.5 block truncate text-[13px] text-muted-foreground">{meta}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {status}
        {!q.locked && <CaretRightIcon weight="bold" aria-hidden className="size-3.5 text-gray-300 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5 group-hover:text-gray-400" />}
      </span>
    </>
  )

  // Hairline dividers start at the text, not the edge, like an iOS inset list.
  const row = "flex min-h-[68px] items-center gap-4 py-3 pr-4 pl-0"
  return (
    <li className="group relative pl-5 after:absolute after:right-0 after:bottom-0 after:left-5 after:h-px after:bg-gray-200/70 last:after:hidden">
      {q.locked ? (
        <div className={row}>{inner}</div>
      ) : (
        <Link
          href={`/quizzes/${q.id}`}
          className={cn(
            row,
            "-ml-5 pl-5 touch-manipulation transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 focus-visible:bg-gray-50 focus-visible:outline-none"
          )}
        >
          {inner}
        </Link>
      )}
    </li>
  )
}

/**
 * Larger screens: the course filter as a macOS-style segmented control. A gray track with a white thumb that
 * glides to the chosen course, so the selection reads at a glance without extra badges or colour.
 */
function CourseSegments({
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
  const items = [
    { id: null as string | null, title: "All Courses", n: Object.values(counts).reduce((a, b) => a + b, 0) },
    ...courses.map((c) => ({ id: c.id as string | null, title: c.title.replace(/\s*\(\s*([^)]*?)\s*\)\s*$/, " ($1)"), n: counts[c.id] ?? 0 })),
  ]
  const idx = Math.max(0, items.findIndex((it) => it.id === selected))
  return (
    <div role="group" aria-label="Course" className="relative hidden rounded-[12px] bg-[rgba(16,42,67,0.06)] p-[3px] md:flex">
      <span
        aria-hidden
        className="absolute inset-y-[3px] left-[3px] rounded-[9px] bg-white shadow-[0_1px_3px_rgba(16,42,67,0.12),0_0_0_0.5px_rgba(16,42,67,0.06)] transition-transform duration-300 ease-(--ease-drawer) motion-reduce:transition-none"
        style={{ width: `calc((100% - 6px) / ${items.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {items.map((it, i) => {
        const on = i === idx
        return (
          <button
            key={it.id ?? "all"}
            type="button"
            aria-pressed={on}
            title={it.title}
            onClick={() => onSelect(it.id)}
            className={cn(
              "relative z-10 flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-4 text-[14px] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-teal/60 focus-visible:outline-none",
              on ? "font-semibold text-heading" : "font-medium text-gray-500 hover:text-heading"
            )}
          >
            <span className="truncate">{it.title}</span>
            <span className={cn("tnum text-[12px] font-normal", on ? "text-gray-500" : "text-gray-400")}>{it.n}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Larger screens: Practice / Mock as a compact segmented control, a step below the course control in weight. */
function TypeSegments({
  value,
  options,
  onChange,
}: {
  value: QuizType
  options: { value: QuizType; label: string; icon: Icon; count: number }[]
  onChange: (v: QuizType) => void
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="group" aria-label="Test type" className="relative hidden w-[22rem] rounded-[10px] bg-[rgba(16,42,67,0.06)] p-[3px] md:flex">
      <span
        aria-hidden
        className="absolute inset-y-[3px] left-[3px] rounded-[7px] bg-white shadow-[0_1px_3px_rgba(16,42,67,0.12),0_0_0_0.5px_rgba(16,42,67,0.06)] transition-transform duration-300 ease-(--ease-drawer) motion-reduce:transition-none"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => {
        const on = o.value === value
        const I = o.icon
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 text-[13px] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-teal/60 focus-visible:outline-none",
              on ? "font-semibold text-heading" : "font-medium text-gray-500 hover:text-heading"
            )}
          >
            <I weight={on ? "fill" : "regular"} className={cn("size-4 shrink-0", on ? "text-teal" : "text-gray-400")} />
            <span className="truncate">{o.label}</span>
            <span className={cn("tnum text-[12px] font-normal", on ? "text-gray-500" : "text-gray-400")}>{o.count}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Phones: the course filter as one tappable row showing the current course. It opens a bottom sheet with
 * every course, its progress and a check on the chosen one, so long names and many courses never crowd the screen.
 */
function CourseRow({
  courses,
  quizzes,
  selected,
  onSelect,
}: {
  courses: Course[]
  quizzes: MyQuiz[]
  selected: string | null
  onSelect: (courseId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  if (courses.length < 2) return null
  const stat = (qs: MyQuiz[]) => `${qs.length} tests · ${qs.filter((q) => q.attemptCount > 0).length} done`
  const items = [
    { id: null as string | null, title: "All Courses", sub: stat(quizzes) },
    ...courses.map((c) => ({ id: c.id as string | null, title: c.title, sub: stat(quizzes.filter((q) => q.courseId === c.id)) })),
  ]
  const current = items.find((it) => it.id === selected) ?? items[0]
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-white px-4 py-2.5 text-left shadow-[0_1px_2px_rgba(16,42,67,0.04),0_4px_16px_-6px_rgba(16,42,67,0.08)] touch-manipulation transition-[background-color,transform] duration-150 ease-(--ease-out) active:scale-[0.985] active:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal focus-visible:outline-none md:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-muted-foreground">Course</span>
          <span className="block truncate text-[16px] font-semibold tracking-[-0.01em] text-heading">{current.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[15px] font-medium text-teal">
          Change
          <CaretDownIcon weight="bold" aria-hidden className="size-3.5" />
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[85svh] gap-0 rounded-t-[20px] bg-background pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div aria-hidden className="mx-auto mt-2.5 h-[5px] w-9 rounded-full bg-gray-300" />
          <SheetHeader className="px-5 pt-3 pb-3 text-center">
            <SheetTitle className="text-[17px] font-semibold text-heading">Choose a course</SheetTitle>
            <SheetDescription className="sr-only">Filter practice and mock tests by course.</SheetDescription>
          </SheetHeader>
          <ul className="mx-4 mb-2 overflow-y-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,42,67,0.04)]">
            {items.map((it) => {
              const on = it.id === current.id
              return (
                <li key={it.id ?? "all"} className="relative pl-4 after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-gray-200/70 last:after:hidden">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      onSelect(it.id)
                      setOpen(false)
                    }}
                    className="-ml-4 flex min-h-[60px] w-[calc(100%+1rem)] items-center gap-3 py-2.5 pr-4 pl-4 text-left touch-manipulation transition-colors active:bg-gray-100"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[16px] leading-snug", on ? "font-semibold text-heading" : "text-heading")}>{it.title}</span>
                      <span className="tnum mt-0.5 block text-[13px] text-muted-foreground">{it.sub}</span>
                    </span>
                    <CheckIcon weight="bold" aria-hidden className={cn("size-[18px] shrink-0 text-teal", on ? "opacity-100" : "opacity-0")} />
                  </button>
                </li>
              )
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
