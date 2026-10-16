"use client"

import { CheckIcon, LockIcon, PlayCircleIcon, PlayIcon, VideoCameraIcon } from "@phosphor-icons/react/dist/ssr"
import type { Icon } from "@phosphor-icons/react"
import Link from "next/link"
import { Suspense, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import {
  Bar,
  CourseChips,
  Empty,
  Loading,
  ResumeBand,
  SectionHead,
  Segmented,
  clock,
  playerHref,
  useCourseFilter,
  watchState,
  type WatchState,
} from "@/components/learning"
import { LockHint } from "@/components/tier-badge"
import { VIDEO_KIND_LABEL, listMyCourses, listMyVideos, type Course, type MyVideo, type VideoKind } from "@/lib/api"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function LearnYourWayPage() {
  return (
    <AppShell>
      <Suspense>
        <LearnYourWay />
      </Suspense>
    </AppShell>
  )
}

type Show = "all" | WatchState
type Lesson = { id: string; title: string; videos: MyVideo[] }

function LearnYourWay() {
  const [courses, setCourses] = useState<Course[]>([])
  const [videos, setVideos] = useState<MyVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState<Show>("all")
  const [courseId, setCourseId] = useCourseFilter(courses)

  useEffect(() => {
    Promise.all([listMyCourses(100, 0), listMyVideos()])
      .then(([c, v]) => {
        setCourses(c)
        setVideos(v)
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [])

  const inCourse = courseId ? videos.filter((v) => v.courseId === courseId) : videos
  const stateOf = (v: MyVideo) => watchState(v).state
  const count = (s: WatchState) => inCourse.filter((v) => stateOf(v) === s).length
  const shown = show === "all" ? inCourse : inCourse.filter((v) => stateOf(v) === show)
  const resume = inCourse
    .filter((v) => stateOf(v) === "started" && !(v.locked && !v.isFree))
    .sort((a, b) => Date.parse(b.progress!.updatedAt) - Date.parse(a.progress!.updatedAt))[0]
  const perCourse = Object.fromEntries(courses.map((c) => [c.id, videos.filter((v) => v.courseId === c.id).length]))

  // Course → lesson → videos, keeping the server's course and lesson order. Lecture numbers run across
  // the whole course, so they stay put when a filter hides some.
  const number = new Map<string, number>()
  for (const c of courses) videos.filter((v) => v.courseId === c.id).forEach((v, i) => number.set(v.id, i + 1))
  const groupsOf = (kind: VideoKind) => {
    const groups: { courseId: string; courseTitle: string; lessons: Lesson[] }[] = []
    for (const v of shown.filter((x) => x.kind === kind)) {
      let g = groups.find((x) => x.courseId === v.courseId)
      if (!g) groups.push((g = { courseId: v.courseId, courseTitle: v.courseTitle, lessons: [] }))
      let l = g.lessons.find((x) => x.id === v.lessonId)
      if (!l) g.lessons.push((l = { id: v.lessonId, title: v.lessonTitle, videos: [] }))
      l.videos.push(v)
    }
    return groups
  }
  const sections: { kind: VideoKind; title: string; emptyTitle: string; empty: string; icon: Icon }[] = [
    {
      kind: "meet",
      title: "Lecture Recordings",
      emptyTitle: "No lecture recordings yet",
      icon: VideoCameraIcon,
      empty: "Recordings of live meetings appear here once the instructor adds them.",
    },
    {
      kind: "offline",
      title: "Pre-recorded / Offline Recordings",
      emptyTitle: "No offline recordings yet",
      icon: PlayCircleIcon,
      empty: "The instructor hasn't added any pre-recorded lectures.",
    },
  ]

  return (
    <>
      <PageTitle title="Learn Your Way" subtitle="Access recorded courses and instructor-led live classes." />
      <ErrorNote error={error} />
      {loading && <Loading rows={6} />}

      {!loading && !error && courses.length === 0 && (
        <Empty icon={PlayCircleIcon} title="No courses yet" text="Once you're enrolled in a course, its videos show up here." explore />
      )}

      {!loading && courses.length > 0 && (
        <>
          <CourseChips courses={courses} selected={courseId} onSelect={setCourseId} counts={perCourse} />

          {resume && <ResumeBand video={resume} />}

          <div className="space-y-8">
            <Segmented<Show>
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: "all", label: "All lectures", count: inCourse.length },
                { value: "started", label: "In progress", count: count("started") },
                { value: "new", label: "Not started", count: count("new") },
                { value: "done", label: "Completed", count: count("done") },
              ]}
            />

            {sections.map((sec) => {
              const groups = groupsOf(sec.kind)
              const total = inCourse.filter((v) => v.kind === sec.kind).length
              return (
                <section key={sec.kind} aria-label={sec.title} className="space-y-4">
                  <SectionHead title={sec.title} aside={<span className="tnum">{total} {total === 1 ? "recording" : "recordings"}</span>} />
                  {total === 0 ? (
                    <Empty icon={sec.icon} title={sec.emptyTitle} text={sec.empty} />
                  ) : groups.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No {show === "done" ? "completed" : show === "started" ? "in-progress" : "unstarted"} lectures here.
                    </p>
                  ) : (
                    groups.map((g) => {
                      const all = videos.filter((v) => v.courseId === g.courseId && v.kind === sec.kind)
                      const watched = all.filter((v) => stateOf(v) === "done").length
                      return (
                        <div key={g.courseId} className="space-y-4">
                          {(!courseId || courses.length === 1) && (
                            <div className="flex items-baseline justify-between gap-4">
                              <h3 className="text-[15px] font-medium text-heading">{g.courseTitle}</h3>
                              <span className="tnum text-sm text-muted-foreground">
                                {watched} of {all.length} watched
                              </span>
                            </div>
                          )}
                          <div className="space-y-4">
                            {g.lessons.map((l) => (
                              <LessonBlock key={l.id} lesson={l} number={number} />
                            ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function LessonBlock({ lesson, number }: { lesson: Lesson; number: Map<string, number> }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-baseline justify-between gap-4 border-b border-border bg-muted/60 px-5 py-3">
        <CardTitle className="font-sans text-[15px] font-medium text-heading">{lesson.title}</CardTitle>
        <span className="tnum text-xs text-muted-foreground">
          {lesson.videos.length} {lesson.videos.length === 1 ? "lecture" : "lectures"}
        </span>
      </CardHeader>
      <ol className="divide-y divide-border">
        {lesson.videos.map((v) => (
          <li key={v.id}>
            <LectureRow video={v} n={number.get(v.id) ?? 0} />
          </li>
        ))}
      </ol>
    </Card>
  )
}

function LectureRow({ video, n }: { video: MyVideo; n: number }) {
  const { state, pct } = watchState(video)
  const duration = video.progress?.durationSec
  if (video.locked && !video.isFree)
    return (
      <div className="flex items-center gap-4 bg-gray-50 px-5 py-3.5" aria-label={`${video.title}, locked`}>
        <span className="tnum w-5 shrink-0 text-right text-[13px] text-gray-400">{n}</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <LockIcon className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[15px] text-gray-600">
          {video.title}
          <span className="ml-2 text-xs text-muted-foreground">{VIDEO_KIND_LABEL[video.kind]}</span>
        </p>
        <LockHint tags={video.tiers} />
      </div>
    )
  return (
    <Link href={playerHref(video)} className="group flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-gray-50">
      <span className="tnum w-5 shrink-0 text-right text-[13px] text-gray-400">{n}</span>
      <StatusMark state={state} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[15px] text-heading", state === "done" && "text-gray-500")}>{video.title}</p>
        <p
          className={cn(
            "mt-0.5 text-xs sm:hidden",
            state === "started" ? "text-primary" : state === "done" ? "text-teal" : "text-muted-foreground"
          )}
        >
          {label(state, pct, video)}
        </p>
      </div>
      <div className="hidden w-36 shrink-0 items-center gap-3 sm:flex">
        {state === "started" && pct !== null ? (
          <>
            <Bar value={pct} tone="primary" className="flex-1" />
            <span className="tnum w-9 text-right text-xs text-primary">{Math.round(pct)}%</span>
          </>
        ) : (
          <span className={cn("ml-auto text-xs", state === "done" ? "text-teal" : "text-gray-400")}>{label(state, pct, video)}</span>
        )}
      </div>
      <span className="tnum hidden w-14 shrink-0 text-right text-[13px] text-muted-foreground sm:block">{duration ? clock(duration) : ""}</span>
    </Link>
  )
}

function label(state: WatchState, pct: number | null, v: MyVideo) {
  if (state === "done") return "Watched"
  if (state === "started") return pct !== null ? `${Math.round(pct)}% watched` : `Stopped at ${clock(v.progress!.positionSec)}`
  return "Not started"
}

function StatusMark({ state }: { state: WatchState }) {
  if (state === "done")
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal text-white" aria-label="Watched">
        <CheckIcon className="size-3.5" />
      </span>
    )
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
        state === "started"
          ? "border-primary text-primary group-hover:bg-primary group-hover:text-white"
          : "border-gray-300 text-gray-400 group-hover:border-navy group-hover:bg-navy group-hover:text-white"
      )}
    >
      <PlayIcon weight="fill" className="ml-px size-3" />
    </span>
  )
}
