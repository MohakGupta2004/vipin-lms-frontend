"use client"

import {
  ArrowUpRightIcon,
  BookOpenTextIcon,
  CardsIcon,
  CaretRightIcon,
  CheckIcon,
  CircleNotchIcon,
  MegaphoneSimpleIcon,
  MoonStarsIcon,
  PlayIcon,
  SunHorizonIcon,
  SunIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { CourseBatchBadges } from "@/components/course-badges"
import { StudyBand, deckHref, deckName } from "@/components/flashcard-links"
import { Bar, Empty, Figures, Loading, ResumeBand, SectionHead } from "@/components/learning"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/hooks/use-user"
import { cn } from "@/lib/utils"
import {
  createPost,
  deletePost,
  getMyFlashcards,
  getMyProgress,
  listMyCourses,
  listPosts,
  type Course,
  type CourseProgress,
  type MyFlashcards,
  type Post,
  type ProgressSummary,
} from "@/lib/api"

export default function FeedPage() {
  return (
    <AppShell>
      <Feed />
    </AppShell>
  )
}

function Feed() {
  const user = useUser()!
  // Instructors and admins own courses; students only take them.
  const canTeach = user.role !== "student"
  const [posts, setPosts] = useState<Post[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [flashcards, setFlashcards] = useState<MyFlashcards | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [c, p, pr, fc] = await Promise.all([
        listMyCourses(100, 0),
        listPosts(50, 0),
        // Students' numbers; the dashboard still works without them.
        canTeach ? null : getMyProgress().catch(() => null),
        canTeach ? null : getMyFlashcards().catch(() => null),
      ])
      setCourses(c)
      setPosts(p)
      setProgress(pr)
      setFlashcards(fc)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [canTeach])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const owned = new Set(courses.filter((c) => c.instructorId === user.id).map((c) => c.id))
  // Students open a course straight into its videos; owners go to the course page to manage it.
  const courseHref = (courseId: string) => (canTeach ? `/courses/${courseId}` : `/learn?course=${courseId}`)
  const coursePct = new Map(progress?.courses.map((c) => [c.courseId, c.percent]))
  const resume = progress?.continueWatching[0]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  // The sky for the time of day, drawn small beside the date: a warm sun by day, a lilac moon at night.
  const Sky = hour < 12 ? SunHorizonIcon : hour < 17 ? SunIcon : MoonStarsIcon
  const pctAll = progress?.totals.percent ?? 0
  // One short, honest line of encouragement drawn from where the student actually is.
  const nudge = !progress?.courseCount
    ? null
    : pctAll >= 100
      ? "Every course complete. Brilliant work."
      : resume
        ? "Good to see you back."
        : pctAll === 0
          ? "A great day to begin."
          : "Every session moves you forward."

  return (
    <>
      {/* The date sits under the greeting as a quiet line, not a caps label over it: the heading leads. */}
      <PageTitle
        title={canTeach ? "My courses" : `${greeting}, ${user.firstName}`}
        subtitle={
          canTeach
            ? "Courses you own and the updates you have shared."
            : (
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Sky weight="duotone" className={cn("size-[1.15em] shrink-0", hour < 17 ? "text-[#D9932B]" : "text-[#7A68C6]")} />
                  <span>{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
                  {nudge && (
                    <>
                      <span aria-hidden className="text-heading/20">·</span>
                      <span className="text-heading/75">{nudge}</span>
                    </>
                  )}
                </span>
              )
        }
      />

      <ErrorNote error={error} />

      {/* Wide screens: a main column and a quiet side rail, as Notion and Apple lay out a home page. The wrapper has no box
          below that width (display: contents), so the sections stack and space exactly as they always have. */}
      <div
        className={cn(
          "stagger contents space-y-8 sm:space-y-10",
          !canTeach && "xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-x-10 xl:gap-y-10 xl:space-y-0 xl:[&>*]:col-start-1 xl:[&_h2.display]:text-[1.25rem] xl:[&_h2.display]:font-semibold"
        )}
      >
      {progress && progress.courseCount > 0 && (
        <section className="space-y-4">
          {resume && <ResumeBand video={resume} className="leaf" />}
          <div className={cn(!canTeach && "xl:hidden")}>
          <Figures
            items={[
              {
                label: "Overall progress",
                value: `${progress.totals.percent}%`,
                href: "/progress",
              },
              {
                label: "Videos completed",
                value: progress.totals.videosCompleted,
                of: progress.totals.videosTotal,
                href: "/learn",
              },
              {
                label: "Tests attempted",
                value: progress.totals.practiceDone + progress.totals.mockDone,
                of: progress.totals.practiceTotal + progress.totals.mockTotal,
                href: "/practice",
              },
              {
                label: "Average mock score",
                value: progress.totals.mockAvgPercent === null ? "–" : `${progress.totals.mockAvgPercent}%`,
                href: "/progress",
              },
            ]}
          />
          </div>
        </section>
      )}

      {!canTeach && (progress?.courseCount || flashcards) && (
        <Rail progress={progress} flashcards={courses.length > 0 ? flashcards : null} />
      )}

      {!canTeach && flashcards && courses.length > 0 && (
        <section className="space-y-4 xl:hidden">
          <SectionHead
            title="Flashcards"
            aside={
              flashcards.decks.length > 0 && (
                <Link href="/flashcards" className="-m-2 inline-block p-2 hover:text-heading hover:underline">
                  All decks
                </Link>
              )
            }
          />
          {flashcards.decks.length > 0 ? (
            <StudyBand deck={flashcards.recent} />
          ) : (
            <>
              <Empty icon={CardsIcon} title="No flashcards yet" text="Your instructors haven't published any. They'll show up here for quick revision." className="md:hidden" />
              {/* Desktop: a quiet one-line notice rather than a tall empty box. */}
              <div className="leaf hidden items-center gap-4 bg-white px-5 py-4 shadow-(--shadow-surface) md:flex">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px_4px_12px_4px] bg-[#E5EEE6] text-[#264536]">
                  <CardsIcon weight="duotone" className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-heading">No flashcards yet</p>
                  <p className="text-[13px] text-heading/55">Your instructors haven&apos;t published any. They&apos;ll show up here for quick revision.</p>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <section className="space-y-4">
        <SectionHead
          title={canTeach ? "Courses" : "Your courses"}
          aside={courses.length > 0 && <span className="tnum">{canTeach ? courses.length : `${courses.length} enrolled`}</span>}
        />
        {loading && (canTeach ? <Loading rows={3} /> : <CourseCardsLoading />)}
        {!loading && courses.length === 0 && !error && (
          <Empty
            icon={BookOpenTextIcon}
            title={canTeach ? "No courses yet" : "You're not enrolled yet"}
            text={canTeach ? "You don't own any courses yet." : "Free lessons are open to everyone while you wait to be enrolled."}
            explore={!canTeach}
          />
        )}
        {/* Students: each course is a card of its own, the thing on this page they open most. */}
        {!canTeach && courses.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 md:gap-5">
            {courses.map((c, i) => (
              <li key={c.id} className={cn("flex", courses.length === 1 && "sm:col-span-2")}>
                <StudentCourseCard course={c} index={i} progress={progress?.courses.find((p) => p.courseId === c.id)} href={courseHref(c.id)} />
              </li>
            ))}
          </ul>
        )}
        {canTeach && courses.length > 0 && (
          <Card className="gap-0 overflow-hidden py-0">
            <ul className="divide-y divide-border">
            {courses.map((c) => {
              const pct = coursePct.get(c.id)
              return (
                <li key={c.id}>
                  <Link
                    href={courseHref(c.id)}
                    className="group relative grid touch-manipulation grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-4 pr-10 pl-5 transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 sm:grid-cols-[minmax(0,1fr)_11rem_1rem] sm:pr-5 md:py-3.5 md:hover:bg-black/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="display line-clamp-2 text-[1.125rem] leading-snug text-heading sm:line-clamp-1 sm:text-[1.25rem] md:text-[1.0625rem] md:font-semibold">{c.title}</p>
                      {c.shortDescription && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{c.shortDescription}</p>}
                    </div>
                    {canTeach ? (
                      <span className="flex flex-wrap items-center gap-1.5 justify-self-end sm:justify-self-start">
                        <Badge variant={c.status === "published" ? "default" : "secondary"}>{c.status}</Badge>
                        <CourseBatchBadges course={c} showPrivate />
                      </span>
                    ) : pct !== undefined ? (
                      <div className="flex items-center gap-3 max-sm:col-span-2">
                        <Bar value={pct} className={cn("flex-1", pct >= 100 ? DONE_BAR : PROGRESS_BAR)} />
                        <span className={cn("tnum w-9 text-right text-xs text-heading", pct >= 100 && DONE_TEXT)}>{pct}%</span>
                      </div>
                    ) : (
                      <span />
                    )}
                    <CaretRightIcon weight="bold" className="absolute top-1/2 right-4 size-3.5 -translate-y-1/2 text-gray-300 transition-transform duration-150 group-active:translate-x-0.5 sm:static sm:size-4 sm:translate-y-0 sm:group-hover:translate-x-0.5 sm:group-hover:text-heading" />
                  </Link>
                </li>
              )
            })}
            </ul>
          </Card>
        )}
      </section>

      {canTeach && owned.size > 0 && <NewPost courses={courses} onPosted={load} />}

      <section className="space-y-4">
        <SectionHead title={canTeach ? "Updates" : "From your instructors"} />
        {loading && <Loading rows={2} />}
        {!loading && posts.length === 0 && (
          <div className="leaf flex items-center gap-4 bg-white px-5 py-4 shadow-(--shadow-surface)">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px_4px_12px_4px] bg-[#EAE6F4] text-[#3A3163]">
              <MegaphoneSimpleIcon weight="duotone" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-heading">No updates yet</p>
              <p className="text-[13px] text-heading/55">
                {canTeach ? "Updates you post to your courses appear here." : "Announcements and links from your instructors will appear here."}
              </p>
            </div>
          </div>
        )}
        {posts.length > 0 && (
          <ol className="divide-y divide-border rounded-xl bg-card px-4 shadow-[0_1px_2px_rgba(16,42,67,0.04),0_4px_16px_-6px_rgba(16,42,67,0.08)] md:rounded-none md:border-y md:border-border md:bg-transparent md:px-0 md:shadow-none">
            {posts.map((p) => (
              <li key={p.id} className="flex gap-4 py-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-medium text-white">
                  {p.authorName.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] text-muted-foreground">
                      <span className="font-medium text-heading">{p.authorName}</span>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <Link href={courseHref(p.courseId)} className="hover:text-heading hover:underline">
                        {p.courseTitle}
                      </Link>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <time dateTime={p.createdAt} title={new Date(p.createdAt).toLocaleString()}>
                        {relative(p.createdAt)}
                      </time>
                    </p>
                    {canTeach && owned.has(p.courseId) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete post"
                        className="-mt-1 text-gray-400"
                        onClick={async () => {
                          if (!confirm("Delete this post?")) return
                          try {
                            await deletePost(p.id)
                            setPosts((x) => x.filter((y) => y.id !== p.id))
                          } catch (e) {
                            setError(errMsg(e))
                          }
                        }}
                      >
                        <TrashIcon />
                      </Button>
                    )}
                  </div>
                  {/* Rendered as text, never as HTML. */}
                  <p className="max-w-[68ch] text-[15px] leading-relaxed whitespace-pre-wrap text-gray-700">{p.content}</p>
                  {p.links && p.links.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {p.links.map((l) => (
                        <li key={l}>
                          <a
                            href={l}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-1 break-all text-primary hover:underline"
                          >
                            {l}
                            <ArrowUpRightIcon className="size-3.5 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      </div>
    </>
  )
}

/*
 * Desktop colour, two hues with one job each, as in Apple's own apps. Blue is the accent: progress and the action to take.
 * Green is achievement: what's mastered or finished. Everything else stays navy and gray. Phones keep the navy bars.
 */
// Bars are 6px on desktop so their colour reads at a glance; 4px on phones as before.
const BAR = "md:[&_[data-slot=progress-track]]:h-1.5"
const PROGRESS_BAR = `${BAR} md:[&_[data-slot=progress-indicator]]:bg-primary md:[&_[data-slot=progress-track]]:bg-primary/[0.12]`
const DONE_BAR = `${BAR} md:[&_[data-slot=progress-indicator]]:bg-[#34C759] md:[&_[data-slot=progress-track]]:bg-[#34C759]/[0.15]`
const DONE_TEXT = "md:text-[#248A3D]"

/**
 * A course's short code and its title without it: "Investment Funds in Canada ( IFC )" → "IFC" and "Investment Funds in
 * Canada". Titles without a code in brackets keep their full name and use the initials of their first words.
 */
function courseName(title: string) {
  const m = title.match(/^(.*?)\s*\(\s*([A-Za-z0-9&]{2,6})\s*\)\s*$/)
  if (m && m[1]) return { code: m[2].toUpperCase(), name: m[1] }
  const initials = title.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 3).map((w) => w[0].toUpperCase()).join("")
  return { code: initials || "•", name: title }
}

/* Cover tones: soft paper colours, each with its own deep ink for the code, status and progress line, so a shelf of
   courses reads as calm colour rather than a row of dark slabs. Blue stays the page's accent for actions; the covers are
   identity, so none of them is blue. They follow list order, so neighbours never match. */
const COVERS = [
  { bg: "#E5EEE6", glow: "#F3F8F2", ink: "#264536", bar: "#3F8A63" }, // sage
  { bg: "#F4E8D9", glow: "#FBF5EC", ink: "#5B3A1E", bar: "#C27A35" }, // apricot
  { bg: "#EAE6F4", glow: "#F6F4FB", ink: "#3A3163", bar: "#7A68C6" }, // lilac
  { bg: "#F4E4E2", glow: "#FBF3F2", ink: "#5A2C2B", bar: "#C25A52" }, // rose clay
]

const STATUS = {
  new: { label: "Not started", cta: "Start" },
  started: { label: "In progress", cta: "Continue" },
  done: { label: "Completed", cta: "Review" },
} as const

/**
 * One enrolled course as a cover, the way Books and TV shelve things: the code set large on a dark tone, where you are
 * along its bottom edge, and one play control. Pointing at it deepens the card, lifts the code, and opens the play
 * control into its verb; pressing settles the whole card. The title link is stretched over it, so it is one target.
 */
function StudentCourseCard({ course, progress: p, href, index }: { course: Course; progress?: CourseProgress; href: string; index: number }) {
  const pct = Math.max(0, Math.min(100, p?.percent ?? 0))
  const key = pct >= 100 ? "done" : pct > 0 || (p && (p.videosInProgress > 0 || p.quizAttempts > 0)) ? "started" : "new"
  const status = STATUS[key]
  const cover = COVERS[index % COVERS.length]
  const { code, name } = courseName(course.title)
  const tests = p ? p.practiceTotal + p.mockTotal : 0
  // Only what the course actually has: a course with no videos doesn't say "0 of 0 videos".
  const meta = [
    p && p.videosTotal > 0 && `${p.videosCompleted} of ${p.videosTotal} videos`,
    p && tests > 0 && `${p.practiceDone + p.mockDone} of ${tests} tests`,
  ].filter(Boolean)
  return (
    <Card className="course-card tap group relative w-full gap-0 overflow-hidden py-0 has-[.tap-link:focus-visible]:outline-2 has-[.tap-link:focus-visible]:outline-offset-2 has-[.tap-link:focus-visible]:outline-ring">
      <div
        className="relative h-28 overflow-hidden px-5 pt-4 text-(--ink) shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-0.5px_0_rgba(0,0,0,0.05)]"
        style={
          {
            "--ink": cover.ink,
            "--bar": key === "done" ? "#34C759" : cover.bar,
            backgroundColor: cover.bg,
            backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${cover.glow} 0%, transparent 60%)`,
          } as React.CSSProperties
        }
      >
        {/* One quiet disc of the cover's own ink behind the play control gives the flat colour depth; it eases
            outward under the pointer while a soft light rises in the corner. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -bottom-20 size-52 rounded-full bg-(--ink)/[0.055] transition-transform duration-500 ease-(--ease-out) group-hover:scale-110"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(255,255,255,0.55),transparent_60%)] opacity-0 transition-opacity duration-300 ease-(--ease-out) group-hover:opacity-100"
        />
        <p
          aria-hidden
          className="display absolute bottom-5 left-5 text-[2.75rem] leading-none font-bold tracking-[-0.035em] text-(--ink) transition-transform duration-300 ease-(--ease-out) group-hover:-translate-y-0.5"
        >
          {code}
        </p>
        <span
          aria-hidden
          className="absolute right-4 bottom-4 flex h-10 items-center rounded-full bg-white/90 pr-3.5 pl-3 text-(--ink) shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.05),0_8px_20px_-10px_rgba(0,0,0,0.3)] backdrop-blur-sm transition-[transform,background-color] duration-200 ease-(--ease-out) group-hover:bg-white group-active:scale-95"
        >
          {key === "done" ? <CheckIcon weight="bold" className="size-4" /> : <PlayIcon weight="fill" className="size-4" />}
          {/* The verb opens out of the control on hover; at rest, and on touch, it is a round play button. */}
          <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-300 ease-(--ease-out) group-hover:grid-cols-[1fr]">
            <span className="overflow-hidden text-[13px] font-semibold whitespace-nowrap">
              <span className="pl-1.5">{status.cta}</span>
            </span>
          </span>
        </span>
        <Progress
          value={pct}
          aria-label={`${name}: ${pct}% complete`}
          className="absolute inset-x-0 bottom-0 gap-0 [&_[data-slot=progress-indicator]]:rounded-none [&_[data-slot=progress-indicator]]:bg-(--bar) [&_[data-slot=progress-track]]:h-[3px] [&_[data-slot=progress-track]]:rounded-none [&_[data-slot=progress-track]]:bg-(--ink)/10"
        />
      </div>

      <div className="flex flex-1 flex-col px-5 pt-4 pb-5">
        <h3 className="display line-clamp-2 text-[1.0625rem] leading-snug tracking-[-0.015em] text-heading">
          <Link href={href} className="tap-link outline-none [overflow-wrap:anywhere] after:absolute after:inset-0">
            {name}
          </Link>
        </h3>
        {course.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{course.shortDescription}</p>
        )}
        {/* Where you stand, in words at full contrast beside what the course holds; the cover stays artwork. */}
        <div className="mt-auto flex items-end justify-between gap-4 pt-4 text-[13px]">
          <p className="tnum min-w-0 text-muted-foreground">{meta.join("  ·  ")}</p>
          <p className="tnum inline-flex shrink-0 items-center gap-1.5 font-semibold text-heading">
            {key === "done" && <CheckIcon weight="bold" className="size-3.5 text-[#248A3D]" />}
            {key === "started" ? (
              <>
                {pct}%<span className="font-normal text-muted-foreground">complete</span>
              </>
            ) : (
              status.label
            )}
          </p>
        </div>
      </div>
    </Card>
  )
}

/** Placeholder covers shaped like the real ones, so nothing jumps when courses arrive. */
function CourseCardsLoading() {
  return (
    <ul aria-busy="true" aria-label="Loading courses" className="grid gap-4 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <li key={i}>
          <Card className="course-card gap-0 overflow-hidden py-0">
            <Skeleton className="h-28 rounded-none" />
            <div className="px-5 pt-4 pb-5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2.5 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
              <Skeleton className="mt-5 h-3 w-1/3" />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}

/**
 * Wide screens: the at-a-glance column. Progress reads as a short list of properties under one headline number,
 * and flashcards sit beneath it, so the main column is left for what you'll actually open.
 */
function Rail({ progress, flashcards }: { progress: ProgressSummary | null; flashcards: MyFlashcards | null }) {
  const t = progress?.totals
  const deck = flashcards?.recent ?? flashcards?.decks[0] ?? null
  return (
    <aside className="hidden space-y-4 xl:sticky xl:top-20 xl:col-start-2! xl:row-span-6 xl:row-start-1 xl:block">
      {t && (
        <RailCard title="Progress" href="/progress" link="Details">
          <div className="px-5 pt-1 pb-4">
            <p className="display tnum text-[2.25rem] leading-none text-heading">{t.percent}%</p>
            <p className="mt-1.5 text-[13px] text-heading/50">of all your course work</p>
            <Bar value={t.percent} className={cn("mt-3.5", t.percent >= 100 ? DONE_BAR : PROGRESS_BAR)} />
          </div>
          <dl className="border-t border-black/[0.06]">
            {[
              { label: "Videos completed", value: `${t.videosCompleted} of ${t.videosTotal}`, href: "/learn" },
              { label: "Tests attempted", value: `${t.practiceDone + t.mockDone} of ${t.practiceTotal + t.mockTotal}`, href: "/practice" },
              { label: "Average mock score", value: t.mockAvgPercent === null ? "–" : `${t.mockAvgPercent}%`, href: "/progress" },
            ].map((r) => (
              <Link
                key={r.label}
                href={r.href}
                className="group flex items-center justify-between gap-3 px-5 py-2.5 text-[13px] transition-colors duration-150 not-last:border-b not-last:border-black/[0.05] hover:bg-black/[0.02]"
              >
                <dt className="text-heading/60">{r.label}</dt>
                <dd className="tnum flex items-center gap-1.5 font-medium text-heading">
                  {r.value}
                  <CaretRightIcon weight="bold" className="size-3 text-heading/25 transition-transform duration-150 group-hover:translate-x-0.5" />
                </dd>
              </Link>
            ))}
          </dl>
        </RailCard>
      )}

      {flashcards && (
        <RailCard title="Flashcards" href={flashcards.decks.length > 0 ? "/flashcards" : undefined} link="All decks">
          {deck ? (
            <div className="space-y-3 px-5 pt-1 pb-5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-heading">{deckName(deck)}</p>
                <p className="truncate text-[13px] text-heading/50">{deck.courseTitle}</p>
              </div>
              {/* What's mastered is an achievement, so this one bar is green. */}
              <Bar value={deck.cardCount ? (deck.myMastered / deck.cardCount) * 100 : 0} className={DONE_BAR} />
              <div className="flex items-center justify-between gap-3">
                <span className="tnum text-[13px] text-heading/55">
                  <span className={cn("font-semibold text-heading", deck.myMastered > 0 && DONE_TEXT)}>{deck.myMastered}</span> of {deck.cardCount} mastered
                </span>
                <Link href={deckHref(deck.id)} className={cn(buttonVariants({ size: "sm" }), "h-8 rounded-full bg-primary px-4 hover:bg-brand-blue-dark")}>
                  Study
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex gap-3.5 px-5 pt-1.5 pb-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px_4px_11px_4px] bg-[#E5EEE6] text-[#264536]">
                <CardsIcon weight="duotone" className="size-[18px]" />
              </span>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-heading">No decks yet.</span> When your instructors publish flashcards, they&apos;ll show up here for quick revision.
              </p>
            </div>
          )}
        </RailCard>
      )}
    </aside>
  )
}

function RailCard({ title, href, link, children }: { title: string; href?: string; link: string; children: React.ReactNode }) {
  return (
    <section className="leaf overflow-hidden bg-white shadow-(--shadow-surface)">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-[13px] font-semibold text-heading/60">{title}</h2>
        {href && (
          <Link href={href} className="text-[13px] font-medium text-primary transition-opacity hover:opacity-70">
            {link}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** "5h ago", "2d ago", then a date. */
function relative(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function NewPost({ courses, onPosted }: { courses: Course[]; onPosted: () => void }) {
  const me = useUser()!
  const [courseId, setCourseId] = useState("")
  const [content, setContent] = useState("")
  const [links, setLinks] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!courseId) return setError("Choose a course.")
    setSaving(true)
    try {
      await createPost({
        courseId,
        content: content.trim(),
        links: links.split("\n").map((l) => l.trim()).filter(Boolean),
      })
      setContent("")
      setLinks("")
      onPosted()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Post an update</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="pcourse">Course</FieldLabel>
            <Select id="pcourse" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Select a course…</option>
              {courses.filter((c) => c.instructorId === me.id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pcontent">Message</FieldLabel>
            <Textarea id="pcontent" required value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="plinks">Links (one per line, http or https)</FieldLabel>
            <Textarea id="plinks" className="min-h-14" value={links} onChange={(e) => setLinks(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving && <CircleNotchIcon className="animate-spin" />}
            Post
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
