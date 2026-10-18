"use client"

import { CaretRightIcon, ChartLineUpIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Bar, Empty, Figures, Loading, ResumeBand, SectionHead, clock, hoursMinutes, playerHref, watchState } from "@/components/learning"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getMyProgress, type CourseProgress, type ProgressSummary } from "@/lib/api"

export default function TrackYourProgressPage() {
  return (
    <AppShell>
      <TrackYourProgress />
    </AppShell>
  )
}

function TrackYourProgress() {
  const [data, setData] = useState<ProgressSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyProgress()
      .then(setData)
      .catch((e) => setError(errMsg(e)))
  }, [])

  const t = data?.totals
  const [resume, ...more] = data?.continueWatching ?? []

  return (
    <>
      <PageTitle title="Track Your Progress" subtitle="Monitor your learning and pick up where you left off." />
      <ErrorNote error={error} />
      {!data && !error && <Loading rows={3} />}

      {data && data.courseCount === 0 && (
        <Empty icon={ChartLineUpIcon} title="Nothing to track yet" text="Once you're enrolled in a course, your progress shows up here." explore />
      )}

      {data && t && data.courseCount > 0 && (
        <>
          <Overall totals={t} courseCount={data.courseCount} />

          <section className="space-y-4">
            <SectionHead title="In numbers" />
            <Figures
              items={[
                { label: "Videos completed", value: t.videosCompleted, of: t.videosTotal },
                { label: "Videos in progress", value: t.videosInProgress },
                { label: "Time watched", value: hoursMinutes(t.watchedSec), note: "Approximate" },
                { label: "Study notes", value: t.notesTotal, note: "Available in your courses" },
                { label: "Practice tests done", value: t.practiceDone, of: t.practiceTotal },
                { label: "Mock tests taken", value: t.mockDone, of: t.mockTotal },
                { label: "Mock tests passed", value: t.mockPassed, of: t.mockDone },
                {
                  label: "Average mock score",
                  value: t.mockAvgPercent === null ? "–" : `${t.mockAvgPercent}%`,
                  note: "Best attempt of each test",
                },
              ]}
            />
          </section>

          {resume && (
            <section className="space-y-4">
              <SectionHead title="Pick up where you left off" />
              <ResumeBand video={resume} />
              {more.length > 0 && (
                <Card className="gap-0 overflow-hidden py-0">
                <ul className="divide-y divide-border">
                  {more.map((v) => {
                    const { pct } = watchState(v)
                    return (
                      <li key={v.id}>
                        <Link href={playerHref(v)} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                            <PlayIcon weight="fill" className="ml-px size-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] text-heading">{v.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{v.courseTitle}</p>
                          </div>
                          <span className="tnum shrink-0 text-xs text-muted-foreground">
                            {pct !== null ? `${Math.round(pct)}%` : `at ${clock(v.progress!.positionSec)}`}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                </Card>
              )}
            </section>
          )}

          <section className="space-y-4">
            <SectionHead title="By course" />
            <Card className="gap-0 overflow-hidden py-0">
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Course</TableHead>
                    <TableHead className="w-48">Progress</TableHead>
                    <TableHead className="hidden w-20 lg:table-cell">Videos</TableHead>
                    <TableHead className="hidden w-20 lg:table-cell">Practice</TableHead>
                    <TableHead className="hidden w-20 lg:table-cell">Mock</TableHead>
                    <TableHead className="hidden w-24 lg:table-cell">Avg. score</TableHead>
                    <TableHead className="hidden w-10 lg:table-cell" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.courses.map((c) => (
                    <CourseRow key={c.courseId} course={c} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          </section>
        </>
      )}
    </>
  )
}

/** Overall percent, and a bar that shows what it is made of. */
function Overall({ totals: t, courseCount }: { totals: CourseProgress; courseCount: number }) {
  const all = t.videosTotal + t.practiceTotal + t.mockTotal
  const seg = (n: number) => (all ? (n / all) * 100 : 0)
  return (
    <section className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end lg:gap-14">
      <div>
        <p className="text-sm text-muted-foreground">Overall progress</p>
        <p className="display tnum mt-4 text-[5.5rem] leading-[0.8] text-heading">
          {t.percent}
          <span className="text-[3rem] text-gray-400">%</span>
        </p>
      </div>
      <div className="space-y-4 lg:pb-2">
        <p className="max-w-2xl text-[15px] leading-relaxed text-gray-600">
          Across {courseCount} {courseCount === 1 ? "course" : "courses"} you&apos;ve finished{" "}
          <strong className="font-medium text-heading">
            {t.videosCompleted} of {t.videosTotal} videos
          </strong>{" "}
          and attempted{" "}
          <strong className="font-medium text-heading">
            {t.practiceDone + t.mockDone} of {t.practiceTotal + t.mockTotal} tests
          </strong>
          .
        </p>
        <div>
          <div className="flex h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
            <div className="h-full bg-navy" style={{ width: `${seg(t.videosCompleted)}%` }} />
            <div className="h-full bg-teal" style={{ width: `${seg(t.practiceDone)}%` }} />
            <div className="h-full bg-secondary" style={{ width: `${seg(t.mockDone)}%` }} />
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
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
      </div>
    </section>
  )
}

function CourseRow({ course: c }: { course: CourseProgress }) {
  const cell = (done: number, total: number) => (
    <span className="tnum text-heading">
      {done}
      <span className="text-gray-400">/{total}</span>
    </span>
  )
  return (
    <TableRow className="group relative touch-manipulation active:bg-gray-100">
      <TableCell className="max-w-0 py-4 pl-5">
        {/* The title link covers the row, so the whole row opens the course's videos. */}
        <Link href={`/learn?course=${c.courseId}`} className="block truncate text-[15px] text-heading after:absolute after:inset-0">
          {c.courseTitle}
        </Link>
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
      <TableCell className="hidden lg:table-cell">{cell(c.practiceDone, c.practiceTotal)}</TableCell>
      <TableCell className="hidden lg:table-cell">{cell(c.mockDone, c.mockTotal)}</TableCell>
      <TableCell className="tnum hidden text-heading lg:table-cell">{c.mockAvgPercent === null ? "–" : `${c.mockAvgPercent}%`}</TableCell>
      <TableCell className="hidden pr-5 lg:table-cell">
        <CaretRightIcon className="size-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-heading" />
      </TableCell>
    </TableRow>
  )
}
