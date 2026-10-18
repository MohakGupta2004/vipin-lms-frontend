"use client"

import { CaretRightIcon, CheckCircleIcon, ListChecksIcon, LockIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { CourseChips, Empty, Loading, Segmented, useCourseFilter } from "@/components/learning"
import { QUIZ_TYPE_PLURAL, listMyCourses, listMyQuizzes, type Course, type MyQuiz, type QuizType } from "@/lib/api"
import { LockHint } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
          <CourseChips courses={courses} selected={courseId} onSelect={setCourseId} counts={perCourse} />

          <div className="space-y-6">
            <Segmented<QuizType>
              label="Test type"
              value={tab}
              onChange={setType}
              options={[
                { value: "practice", label: QUIZ_TYPE_PLURAL.practice, count: practice.length },
                { value: "mock_test", label: QUIZ_TYPE_PLURAL.mock_test, count: mock.length },
              ]}
            />

            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {isMock
                  ? "Timed and scored like the real exam. You see your marks, not the answers."
                  : "Untimed and unmarked. Each answer and its explanation shows as soon as you pick it."}
              </p>
              {shown.length > 0 && (
                <p className="tnum text-sm text-muted-foreground">
                  <span className="display text-xl text-heading">{done}</span> of {shown.length} {isMock ? "taken" : "practised"}
                </p>
              )}
            </div>

            {shown.length === 0 ? (
              <Empty
                icon={ListChecksIcon}
                title={`No ${QUIZ_TYPE_PLURAL[tab].toLowerCase()} yet`}
                text="Your instructor hasn't published any here yet. Check back soon."
              />
            ) : (
              <Card className="gap-0 overflow-hidden py-0">
                <Table>
                  <TableHeader className="bg-muted/60">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">Test</TableHead>
                      <TableHead className="hidden w-28 md:table-cell">Questions</TableHead>
                      <TableHead className="hidden w-28 md:table-cell">{isMock ? "Time" : "Format"}</TableHead>
                      <TableHead className="w-36">{isMock ? "Best result" : "Status"}</TableHead>
                      <TableHead className="hidden w-10 md:table-cell" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((q) => (
                      <QuizRow key={q.id} quiz={q} showCourse={!courseId && courses.length > 1} />
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  )
}

function QuizRow({ quiz: q, showCourse }: { quiz: MyQuiz; showCourse: boolean }) {
  const isMock = q.type === "mock_test"
  const tried = q.attemptCount > 0
  const time = isMock ? (q.timeLimitSec ? `${Math.round(q.timeLimitSec / 60) || 1} min` : "Untimed") : "Self-paced"
  return (
    <TableRow className="group relative touch-manipulation active:bg-gray-100">
      <TableCell className="max-w-0 py-3.5 pl-5 whitespace-normal">
        {/* The title link covers the row, so the whole row opens the test. A locked test only shows its title. */}
        {q.locked ? (
          <span className="flex items-center gap-2 truncate text-[15px] text-gray-600">
            <LockIcon className="size-4 shrink-0" aria-label="Locked" />
            {q.title}
          </span>
        ) : (
          <Link href={`/quizzes/${q.id}`} className="block truncate text-[15px] text-heading after:absolute after:inset-0">
            {q.title}
          </Link>
        )}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {showCourse && `${q.courseTitle} · `}
          {q.lessonTitle}
        </p>
        <p className="tnum mt-0.5 text-xs text-gray-400 md:hidden">
          {q.questionCount} questions · {time}
          {isMock && q.passPercent !== null && ` · pass ${q.passPercent}%`}
        </p>
      </TableCell>
      <TableCell className="tnum hidden text-gray-600 md:table-cell">{q.questionCount}</TableCell>
      <TableCell className="tnum hidden text-gray-600 md:table-cell">
        {time}
        {isMock && q.passPercent !== null && <span className="block text-xs text-gray-400">pass {q.passPercent}%</span>}
      </TableCell>
      <TableCell>
        {q.locked ? (
          <LockHint tags={q.tiers} />
        ) : !tried ? (
          <span className="text-gray-400">Not attempted</span>
        ) : isMock ? (
          <span className="flex items-baseline gap-2">
            <span className="display tnum text-lg leading-none text-heading">{q.bestPercent ?? 0}%</span>
            <Badge variant={q.passed ? "default" : "outline"}>{q.passed ? "Passed" : "Below pass"}</Badge>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-teal">
            <CheckCircleIcon weight="fill" className="size-4" />
            {q.attemptCount === 1 ? "Practised once" : `Practised ${q.attemptCount}×`}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden pr-5 md:table-cell">
        {!q.locked && (
          <CaretRightIcon className="size-4 text-gray-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-heading" />
        )}
      </TableCell>
    </TableRow>
  )
}
