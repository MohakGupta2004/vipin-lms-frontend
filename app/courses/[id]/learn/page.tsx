"use client"

import { ArrowLeftIcon, ArrowRightIcon, CardsIcon, CaretDownIcon, CircleNotchIcon, FileTextIcon, InfoIcon, ListBulletsIcon, ListChecksIcon, LockIcon, PlayCircleIcon, SidebarSimpleIcon, SkipForwardIcon, TrophyIcon, XIcon } from "@phosphor-icons/react/dist/ssr"
import type { Icon } from "@phosphor-icons/react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"

import { AppShell, errMsg } from "@/components/app-shell"
import { Brand } from "@/components/brand"
import { DeckSummary } from "@/components/flashcard-links"
import { LessonNotes } from "@/components/note-list"
import { QuizList } from "@/components/quiz-list"
import { LockHint } from "@/components/tier-badge"
import { PdfPreview } from "@/components/pdf-preview"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { VideoPlayer } from "@/components/video-player"
import { roleHome, useUser } from "@/hooks/use-user"
import {
  UUID_RE,
  VIDEO_KINDS,
  VIDEO_KIND_LABEL,
  downloadNote,
  getCourse,
  listCourseDecks,
  listCourseVideos,
  listLessons,
  listQuizzes,
  setVideoCompletion,
  type Course,
  type FlashcardDeck,
  type Lesson,
  type Note,
  type Quiz,
  type Tier,
  type Video,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const UP_NEXT_SECONDS = 5

type Section = { lesson: Lesson; videos: Video[] }

export default function LearnPage() {
  return (
    <AppShell bare>
      <Suspense>
        <Learn />
      </Suspense>
    </AppShell>
  )
}

// ── per-browser conveniences (no backend API for these yet) ─────────────────
function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

/**
 * Lectures this user completed in this course. The server is the record (it also feeds Track Your Progress);
 * ticks are shown at once and saved in the background.
 */
function useCompleted(userId: string, courseId: string) {
  const [done, setDoneState] = useState<Set<string>>(() => new Set())
  const set = (videoId: string, on: boolean, save = true) => {
    setDoneState((cur) => {
      if (cur.has(videoId) === on) return cur
      const next = new Set(cur)
      if (on) next.add(videoId)
      else next.delete(videoId)
      return next
    })
    if (save) setVideoCompletion(videoId, on).catch(() => {})
  }
  // Ticks from before completion was saved on the server lived in this browser: send them up once.
  const legacyKey = `lms_done:${userId}:${courseId}`
  const load = useCallback((videos: Video[]) => {
    const server = new Set(videos.filter((v) => v.progress?.completedAt).map((v) => v.id))
    const ids = new Set(videos.map((v) => v.id))
    for (const id of readList(legacyKey)) {
      if (ids.has(id) && !server.has(id)) {
        server.add(id)
        setVideoCompletion(id, true).catch(() => {})
      }
    }
    try {
      localStorage.removeItem(legacyKey)
    } catch {}
    setDoneState(server)
  }, [legacyKey])
  return [done, set, load] as const
}

function Learn() {
  const user = useUser()!
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const requested = params.get("v")
  const fromCourse = params.get("from") === "course"
  const via = params.get("via")
  const valid = UUID_RE.test(id)

  const [course, setCourse] = useState<Course | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(valid)
  const [error, setError] = useState<string | null>(valid ? null : "That is not a valid course ID.")
  const [done, setDone, loadDone] = useCompleted(user.id, id)
  const lastKey = `lms_last:${user.id}:${id}`
  const [lastWatched] = useState(() => readList(lastKey)[0] ?? null)
  const [sidebar, setSidebar] = useState(true)
  const [upNext, setUpNext] = useState<{ from: string; to: string } | null>(null)
  // Opened from the course page (or Explore through it), "back" returns there; otherwise students came from
  // Learn Your Way, so it returns them to this course's videos there.
  const backHref = fromCourse
    ? `/courses/${id}${via === "explore" ? "?from=explore" : ""}`
    : user.role === "student"
      ? `/learn?course=${id}`
      : `/courses/${id}`
  // Tests opened here come back to the player, which keeps its own way back.
  const quizQuery = `from=learn${fromCourse ? `&via=${via === "explore" ? "explore" : "course"}` : ""}`

  useEffect(() => {
    if (!valid) return
    Promise.all([getCourse(id), listLessons(id), listCourseVideos(id)])
      .then(([c, lessons, videos]) => {
        setCourse(c)
        // Only ready videos are playable; keep the course's lesson order.
        const ready = videos.filter((v) => v.status === "ready")
        loadDone(ready)
        // Within a lesson, Offline Recordings come first, then Meet Recordings; next/previous follow that order.
        setSections(
          lessons
            .map((lesson) => ({
              lesson,
              videos: VIDEO_KINDS.flatMap((kind) => ready.filter((v) => v.lessonId === lesson.id && v.kind === kind)),
            }))
            .filter((s) => s.videos.length > 0)
        )
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [id, valid, loadDone])

  const preview = course?.access === "preview"
  const tier: Tier = course?.tier ?? "free"
  // Locked lectures (previewing a course) are listed but never played, so navigation skips them.
  const flat = sections.flatMap((s) => s.videos).filter((v) => !v.locked)
  const lockedCount = sections.reduce((n, s) => n + s.videos.filter((v) => v.locked).length, 0)
  const current =
    flat.find((v) => v.id === requested) ??
    flat.find((v) => v.id === lastWatched) ??
    flat.find((v) => !done.has(v.id)) ??
    flat[0]
  const index = current ? flat.indexOf(current) : -1
  const prev = index > 0 ? flat[index - 1] : undefined
  const next = index >= 0 ? flat[index + 1] : undefined
  const section = sections.find((s) => s.lesson.id === current?.lessonId)
  const sectionNo = section ? sections.indexOf(section) + 1 : 0
  const completed = flat.filter((v) => done.has(v.id)).length

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  // The current lecture's section is always shown open.
  const isOpen = (lessonId: string) => expanded.has(lessonId) !== (lessonId === current?.lessonId)

  function go(v: Video) {
    const old = current?.lessonId
    if (old !== v.lessonId)
      setExpanded((cur) => {
        // Flip both toggles so neither section visibly changes as "current" moves between them.
        const n = new Set(cur)
        for (const l of [old, v.lessonId]) {
          if (!l) continue
          if (n.has(l)) n.delete(l)
          else n.add(l)
        }
        return n
      })
    setUpNext(null)
    write(lastKey, [v.id])
    router.replace(`/courses/${id}/learn?v=${v.id}`, { scroll: false })
  }

  function onEnded() {
    if (!current) return
    setDone(current.id, true, false) // the player already saved it
    if (next) setUpNext({ from: current.id, to: next.id })
  }

  const showUpNext = upNext && upNext.from === current?.id ? flat.find((v) => v.id === upNext.to) : undefined
  const content = (
    <CourseContent
      sections={sections}
      preview={preview}
      tier={tier}
      currentId={current?.id}
      done={done}
      isOpen={isOpen}
      onToggleSection={(lessonId) =>
        setExpanded((cur) => {
          const n = new Set(cur)
          if (n.has(lessonId)) n.delete(lessonId)
          else n.add(lessonId)
          return n
        })
      }
      onToggleDone={(v) => setDone(v.id, !done.has(v.id))}
      onSelect={go}
    />
  )

  return (
    <div className="flex min-h-svh flex-col bg-white phone-landscape:bg-black">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 bg-navy px-4 text-white sm:px-6 phone-landscape:hidden">
        <Link href={roleHome(user.role)} aria-label="Home" className="flex min-h-11 shrink-0 items-center">
          <Brand onDark compact className="[&>span]:hidden sm:[&>span]:flex [&>div]:size-8" />
        </Link>
        <span aria-hidden className="hidden h-6 w-px bg-white/20 sm:block" />
        <Link href={`/courses/${id}${via === "explore" ? "?from=explore" : ""}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-secondary sm:text-base">
          {course?.title ?? "Course"}
        </Link>
        {preview && <Badge variant="lime" className="shrink-0">Free preview</Badge>}
        {flat.length > 0 && <ProgressRing done={completed} total={flat.length} />}
        <Button
          variant="ghost"
          size="sm"
          className="hidden text-white hover:bg-white/10 hover:text-white lg:inline-flex"
          onClick={() => setSidebar((s) => !s)}
          aria-pressed={sidebar}
        >
          {sidebar ? <SidebarSimpleIcon /> : <SidebarSimpleIcon />}
          Course content
        </Button>
        <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "sm", className: "text-white hover:bg-white/10 hover:text-white" })}>
          <ArrowLeftIcon /> <span className="hidden sm:inline">Back to course</span>
        </Link>
      </header>

      {loading && (
        <p className="flex flex-1 items-center justify-center gap-2 text-sm text-gray-500">
          <CircleNotchIcon className="size-4 animate-spin" /> Loading course…
        </p>
      )}
      {!loading && (error || !current) && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <PlayCircleIcon className="size-7" />
          </span>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{error ? "Can't open this course" : lockedCount > 0 ? (tier === "free" ? "Locked" : "Not on your plan") : "No videos yet"}</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              {error ??
                (lockedCount > 0
                  ? tier === "free"
                    ? `None of this course's ${lockedCount} ${lockedCount === 1 ? "lecture is" : "lectures are"} open to preview.`
                    : `This course has ${lockedCount} ${lockedCount === 1 ? "lecture" : "lectures"} but none are included in your plan. Ask your admin to upgrade you.`
                  : "Lectures will appear here once the instructor uploads them and they finish processing.")}
            </p>
          </div>
          <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
            <ArrowLeftIcon /> Back to course
          </Link>
        </div>
      )}

      {!loading && !error && current && (
        <div className="flex flex-1">
          <main className="min-w-0 flex-1">
            {/* Phones: the video stays pinned under the header while the tabs scroll beneath it, and turning
                the phone sideways hands it the whole screen. */}
            <div className="sticky top-14 z-20 bg-black lg:static phone-landscape:static phone-landscape:h-svh">
              <div className="mx-auto aspect-video w-full max-w-[calc((100svh-8rem)*16/9)] phone-landscape:aspect-auto phone-landscape:h-full phone-landscape:max-w-none">
                <VideoPlayer
                  videoId={current.id}
                  title={current.title}
                  onEnded={onEnded}
                  onPrev={prev && (() => go(prev))}
                  onNext={next && (() => go(next))}
                  overlay={
                    showUpNext && (
                      <UpNext
                        key={showUpNext.id}
                        video={showUpNext}
                        sectionTitle={sections.find((s) => s.lesson.id === showUpNext.lessonId)?.lesson.title ?? ""}
                        onPlay={() => go(showUpNext)}
                        onCancel={() => setUpNext(null)}
                      />
                    )
                  }
                />
              </div>
            </div>

            <LectureTabs
              course={course!}
              lesson={section!.lesson}
              video={current}
              sectionNo={sectionNo}
              lectureNo={index + 1}
              totalLectures={flat.length}
              totalSections={sections.length}
              isOwner={user.role !== "student" && course?.instructorId === user.id}
              quizQuery={quizQuery}
              setNotes={(fn) =>
                setSections((ss) =>
                  ss.map((s) => (s.lesson.id === section!.lesson.id ? { ...s, lesson: { ...s.lesson, notes: fn(s.lesson.notes ?? []) } } : s))
                )
              }
              content={content}
              next={next}
              onNext={next && (() => go(next))}
            />
          </main>

          {sidebar && (
            <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-[360px] shrink-0 flex-col border-l border-border bg-white lg:flex xl:w-[400px]">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pr-2 pl-4">
                <h2 className="text-base font-semibold">Course content</h2>
                <Button variant="ghost" size="icon-sm" aria-label="Close course content" onClick={() => setSidebar(false)}>
                  <XIcon />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 15
  const c = 2 * Math.PI * r
  const pct = total ? done / total : 0
  return (
    <div className="flex shrink-0 items-center gap-2" title={`${done} of ${total} lectures complete`}>
      <span className="relative flex size-9 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <TrophyIcon className="size-4 text-secondary" />
      </span>
      <span className="tnum hidden text-xs text-white/80 md:block">
        {done} of {total} complete
      </span>
    </div>
  )
}

function CourseContent({
  sections,
  preview,
  tier,
  currentId,
  done,
  isOpen,
  onToggleSection,
  onToggleDone,
  onSelect,
}: {
  sections: Section[]
  preview: boolean
  tier: Tier
  currentId: string | undefined
  done: Set<string>
  isOpen: (lessonId: string) => boolean
  onToggleSection: (lessonId: string) => void
  onToggleDone: (v: Video) => void
  onSelect: (v: Video) => void
}) {
  // Lecture numbers run across the whole course.
  const firstNo = sections.map((_, i) => sections.slice(0, i).reduce((sum, s) => sum + s.videos.length, 1))
  return (
    <div>
      {sections.map((s, i) => {
        const open = isOpen(s.lesson.id)
        const finished = s.videos.filter((v) => done.has(v.id)).length
        const allLocked = s.videos.every((v) => v.locked)
        return (
          <section key={s.lesson.id} className="border-b border-border">
            <button
              type="button"
              onClick={() => onToggleSection(s.lesson.id)}
              aria-expanded={open}
              className="flex w-full items-start gap-3 bg-gray-50 px-4 py-3.5 text-left transition-colors hover:bg-gray-100"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-1.5 text-sm leading-snug font-semibold text-heading">
                  {allLocked && <LockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />}
                  Section {i + 1}: {s.lesson.title}
                </span>
                <span className="tnum mt-0.5 block text-xs text-muted-foreground">
                  {finished} / {s.videos.length} {s.videos.length === 1 ? "lecture" : "lectures"}
                </span>
              </span>
              <CaretDownIcon className={cn("mt-0.5 size-4 shrink-0 text-heading/70 transition-transform duration-300", open && "rotate-180")} />
            </button>
            <div className="expand" data-open={open}>
              <div>
                {VIDEO_KINDS.map((kind) => {
                  const group = s.videos.filter((v) => v.kind === kind)
                  if (group.length === 0) return null
                  return (
                    <div key={kind}>
                      <h4 className="bg-white px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {VIDEO_KIND_LABEL[kind]}
                      </h4>
                      <ol>
                        {group.map((v) => {
                          const n = firstNo[i] + s.videos.indexOf(v)
                          const active = v.id === currentId
                          const checked = done.has(v.id)
                          if (v.locked)
                            return (
                              <li key={v.id} className="flex items-start gap-3 px-4 py-3 text-muted-foreground">
                                <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm leading-snug">
                                    {n}. {v.title}
                                  </span>
                                  {tier !== "free" && (
                                    <span className="mt-1 block text-xs">
                                      <LockHint courseTier={tier} tags={v.tiers} />
                                    </span>
                                  )}
                                </span>
                              </li>
                            )
                          return (
                            <li
                              key={v.id}
                              className={cn(
                                "relative flex touch-manipulation items-start gap-3 px-4 py-3 transition-colors",
                                active ? "bg-mint" : "hover:bg-gray-50 has-[button:active]:bg-gray-100"
                              )}
                            >
                              {active && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-teal" />}
                              {/* The checkbox sits above the row's stretched button with its own finger-sized target. */}
                              <label className="relative z-10 -m-2.5 flex shrink-0 cursor-pointer p-2.5">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 size-4 cursor-pointer"
                                  checked={checked}
                                  onChange={() => onToggleDone(v)}
                                  aria-label={`Mark "${v.title}" ${checked ? "not complete" : "complete"}`}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => onSelect(v)}
                                aria-current={active ? "true" : undefined}
                                className="min-w-0 flex-1 text-left after:absolute after:inset-0"
                              >
                                <span className={cn("block text-sm leading-snug text-heading", active && "font-semibold")}>
                                  {n}. {v.title}
                                </span>
                                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <PlayCircleIcon className="size-3.5" />
                                  {active ? "Playing" : "Video"}
                                  {preview && <Badge variant="lime" className="ml-1 h-4 px-1.5 text-[10px]">Free</Badge>}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}

function UpNext({ video, sectionTitle, onPlay, onCancel }: { video: Video; sectionTitle: string; onPlay: () => void; onCancel: () => void }) {
  const [left, setLeft] = useState(UP_NEXT_SECONDS)
  const fired = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (left > 0 || fired.current) return
    fired.current = true
    onPlay()
  }, [left, onPlay])

  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="flex size-full items-center justify-center bg-black/80 p-6 backdrop-blur-[2px]">
      <div className="pop w-full max-w-sm text-center text-white">
        <p className="text-xs font-medium text-white/60">Up next</p>
        <p className="mt-2 text-lg leading-snug font-semibold text-balance">{video.title}</p>
        {sectionTitle && <p className="mt-1 truncate text-sm text-white/60">{sectionTitle}</p>}
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play now: ${video.title}`}
          className="group relative mx-auto mt-5 flex size-16 items-center justify-center rounded-full"
        >
          <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="30" cy="30" r={r} fill="none" stroke="white" strokeOpacity={0.2} strokeWidth="3" />
            <circle
              cx="30"
              cy="30"
              r={r}
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (left / UP_NEXT_SECONDS)}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <SkipForwardIcon weight="fill" className="size-6 transition-transform group-hover:scale-110" />
        </button>
        <p className="tnum mt-3 text-sm text-white/70">Playing in {Math.max(0, left)}s</p>
        <Button variant="ghost" size="sm" className="mt-2 text-white hover:bg-white/10 hover:text-white" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

type Tab = "content" | "overview" | "notes" | "quizzes" | "flashcards"

function LectureTabs({
  course,
  lesson,
  video,
  sectionNo,
  lectureNo,
  totalLectures,
  totalSections,
  isOwner,
  quizQuery,
  setNotes,
  content,
  next,
  onNext,
}: {
  course: Course
  lesson: Lesson
  video: Video
  sectionNo: number
  lectureNo: number
  totalLectures: number
  totalSections: number
  isOwner: boolean
  quizQuery: string
  /** Updates this lesson's notes after the owner shares, edits or deletes one. */
  setNotes: (fn: (n: Note[]) => Note[]) => void
  content: React.ReactNode
  next?: Video
  onNext?: () => void
}) {
  // "content" is the mobile-only curriculum tab; on large screens the sidebar shows it, so Overview stands in.
  const [tab, setTab] = useState<Tab>("overview")
  // Keyed by lesson so a stale list never shows after moving to another section.
  const [loaded, setLoaded] = useState<{ lessonId: string; quizzes: Quiz[] } | null>(null)
  const quizzes = loaded?.lessonId === lesson.id ? loaded.quizzes : null
  const [preview, setPreview] = useState<Note | null>(null)
  // The course's decks, fetched once the first time the Flashcards tab opens.
  const [decks, setDecks] = useState<FlashcardDeck[] | null>(null)
  const notes = lesson.notes ?? []

  useEffect(() => {
    listQuizzes(lesson.id)
      .then((qs) => setLoaded({ lessonId: lesson.id, quizzes: isOwner ? qs : qs.filter((q) => q.status === "published") }))
      .catch(() => setLoaded({ lessonId: lesson.id, quizzes: [] }))
  }, [lesson.id, isOwner])

  const wantDecks = tab === "flashcards" && decks === null
  useEffect(() => {
    if (!wantDecks) return
    listCourseDecks(course.id)
      .then(setDecks)
      .catch(() => setDecks([]))
  }, [wantDecks, course.id])

  // Phones get an icon and a short name per tab so all five fit without scrolling sideways.
  const tabs: { key: Tab; label: string; short: string; icon: Icon; className?: string }[] = [
    { key: "content", label: "Course content", short: "Lectures", icon: ListBulletsIcon, className: "lg:hidden" },
    { key: "overview", label: "Overview", short: "About", icon: InfoIcon },
    { key: "notes", label: `Notes${notes.length ? ` (${notes.length})` : ""}`, short: "Notes", icon: FileTextIcon },
    { key: "quizzes", label: `Tests${quizzes?.length ? ` (${quizzes.length})` : ""}`, short: "Tests", icon: ListChecksIcon },
    { key: "flashcards", label: "Flashcards", short: "Cards", icon: CardsIcon },
  ]
  const overviewActive = tab === "overview"

  const overview = (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="tnum text-xs font-medium text-teal">
          Section {sectionNo} · Lecture {lectureNo} of {totalLectures}
        </p>
        <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">{video.title}</h1>
        <p className="text-sm text-muted-foreground">{lesson.title}</p>
      </div>
      {video.description && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">About this lecture</h2>
          <p className="max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-wrap text-gray-700">{video.description}</p>
        </div>
      )}
      {lesson.content && <p className="max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-wrap text-gray-700">{lesson.content}</p>}
      {next && onNext && (
        <button
          type="button"
          onClick={onNext}
          className="group flex w-full max-w-md items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-teal/40 hover:bg-gray-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
            <SkipForwardIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Next lecture</span>
            <span className="block truncate text-sm font-semibold text-heading">{next.title}</span>
          </span>
          <ArrowRightIcon className="size-4 text-heading/50 transition-transform group-hover:translate-x-1" />
        </button>
      )}
      <dl className="grid max-w-md grid-cols-2 gap-4 border-t border-border pt-6">
        <div>
          <dt className="text-xs text-muted-foreground">Sections</dt>
          <dd className="tnum text-2xl font-semibold text-heading">{totalSections}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Lectures</dt>
          <dd className="tnum text-2xl font-semibold text-heading">{totalLectures}</dd>
        </div>
      </dl>
    </div>
  )

  return (
    <div className="phone-landscape:hidden">
      <div role="tablist" aria-label="Lecture" className="grid grid-cols-5 border-b border-border sm:px-4 lg:flex lg:gap-6 lg:px-8">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            aria-label={t.label}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex min-w-0 touch-manipulation flex-col items-center gap-1 border-b-2 border-transparent pt-2.5 pb-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-heading active:bg-gray-50 sm:flex-row sm:justify-center sm:gap-2 sm:py-3.5 sm:text-sm lg:shrink-0 lg:justify-start",
              tab === t.key && "border-heading text-heading",
              // On large screens the hidden "content" tab falls back to Overview.
              t.key === "overview" && tab === "content" && "lg:border-heading lg:text-heading",
              t.key === "content" && tab === "content" && "lg:border-transparent",
              t.className
            )}
          >
            <t.icon className="size-5 shrink-0 sm:size-4 lg:hidden" aria-hidden />
            <span className="max-w-full truncate sm:hidden">{t.short}</span>
            <span className="hidden truncate sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className={cn(tab === "content" ? "lg:px-8 lg:py-8" : "px-4 py-8 sm:px-8")}>
        {tab === "content" && (
          <>
            <div className="lg:hidden">{content}</div>
            <div className="hidden lg:block">{overview}</div>
          </>
        )}
        {overviewActive && overview}
        {tab === "notes" && (
          <div className="max-w-3xl space-y-3">
            <LessonNotes
              lessonId={lesson.id}
              notes={notes}
              setNotes={setNotes}
              isOwner={isOwner}
              onOpen={setPreview}
              tier={course.tier ?? "free"}
              empty={<Empty>No notes for this lecture.</Empty>}
            />
          </div>
        )}
        {tab === "quizzes" && (
          <div className="max-w-3xl space-y-3">
            {quizzes === null && (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <CircleNotchIcon className="size-4 animate-spin" /> Loading…
              </p>
            )}
            {quizzes?.length === 0 && <Empty>No tests for this lecture.</Empty>}
            {quizzes && <QuizList quizzes={quizzes} tier={course.tier ?? "free"} owner={isOwner} linkQuery={quizQuery} />}
          </div>
        )}
        {tab === "flashcards" && (
          <div className="max-w-3xl space-y-6">
            {decks === null && (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <CircleNotchIcon className="size-4 animate-spin" /> Loading…
              </p>
            )}
            {decks && (() => {
              // Only decks with cards show; with none at all there is one plain empty line.
              const lessonDeck = decks.find((d) => d.lessonId === lesson.id && d.cardCount > 0) ?? null
              const courseDeck = decks.find((d) => d.lessonId === null && d.cardCount > 0) ?? null
              if (!lessonDeck && !courseDeck) return <Empty>No flashcards for this lecture.</Empty>
              return (
                <>
                  {lessonDeck && (
                    <section className="space-y-3">
                      <h2 className="text-sm font-medium text-heading">This lesson</h2>
                      <DeckSummary deck={lessonDeck} tier={course.tier ?? "free"} title={`${lesson.title} flashcards`} />
                    </section>
                  )}
                  {courseDeck && (
                    <section className="space-y-3">
                      <h2 className="text-sm font-medium text-heading">Whole course</h2>
                      <DeckSummary deck={courseDeck} tier={course.tier ?? "free"} title="Course-wide flashcards" />
                    </section>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>
      {preview && <PdfPreview title={preview.title} load={() => downloadNote(preview.id)} onClose={() => setPreview(null)} />}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>
  )
}
