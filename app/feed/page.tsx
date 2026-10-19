"use client"

import { ArrowUpRightIcon, BookOpenTextIcon, CardsIcon, CaretRightIcon, CircleNotchIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { StudyBand } from "@/components/flashcard-links"
import { Bar, Empty, Figures, Loading, ResumeBand, SectionHead } from "@/components/learning"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/hooks/use-user"
import {
  createPost,
  deletePost,
  getMyFlashcards,
  getMyProgress,
  listMyCourses,
  listPosts,
  type Course,
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

  return (
    <>
      <PageTitle
        eyebrow={canTeach ? undefined : new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        title={canTeach ? "My courses" : `${greeting}, ${user.firstName}`}
        subtitle={canTeach ? "Courses you own and the updates you have shared." : undefined}
      />

      <ErrorNote error={error} />

      {progress && progress.courseCount > 0 && (
        <section className="space-y-4">
          {resume && <ResumeBand video={resume} />}
          <Figures
            items={[
              { label: "Overall progress", value: `${progress.totals.percent}%`, href: "/progress" },
              { label: "Videos completed", value: progress.totals.videosCompleted, of: progress.totals.videosTotal, href: "/learn" },
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
        </section>
      )}

      {!canTeach && flashcards && courses.length > 0 && (
        <section className="space-y-4">
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
            <Empty icon={CardsIcon} title="No flashcards yet" text="Your instructors haven't published any. They'll show up here for quick revision." />
          )}
        </section>
      )}

      <section className="space-y-4">
        <SectionHead
          title={canTeach ? "Courses" : "Your courses"}
          aside={courses.length > 0 && <span className="tnum">{courses.length}</span>}
        />
        {loading && <Loading rows={3} />}
        {!loading && courses.length === 0 && !error && (
          <Empty
            icon={BookOpenTextIcon}
            title={canTeach ? "No courses yet" : "You're not enrolled yet"}
            text={canTeach ? "You don't own any courses yet." : "Free lessons are open to everyone while you wait to be enrolled."}
            explore={!canTeach}
          />
        )}
        {courses.length > 0 && (
          <Card className="gap-0 overflow-hidden py-0">
            <ul className="divide-y divide-border">
            {courses.map((c) => {
              const pct = coursePct.get(c.id)
              return (
                <li key={c.id}>
                  <Link
                    href={courseHref(c.id)}
                    className="group relative grid touch-manipulation grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-4 pr-10 pl-5 transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 sm:grid-cols-[minmax(0,1fr)_11rem_1rem] sm:pr-5"
                  >
                    <div className="min-w-0">
                      <p className="display line-clamp-2 text-[1.125rem] leading-snug text-heading sm:line-clamp-1 sm:text-[1.25rem]">{c.title}</p>
                      {c.shortDescription && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{c.shortDescription}</p>}
                    </div>
                    {canTeach ? (
                      <Badge variant={c.status === "published" ? "default" : "secondary"} className="justify-self-end sm:justify-self-start">
                        {c.status}
                      </Badge>
                    ) : pct !== undefined ? (
                      <div className="flex items-center gap-3 max-sm:col-span-2">
                        <Bar value={pct} className="flex-1" />
                        <span className="tnum w-9 text-right text-xs text-heading">{pct}%</span>
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
        {!loading && posts.length === 0 && <p className="text-sm text-muted-foreground">No updates yet.</p>}
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
    </>
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
