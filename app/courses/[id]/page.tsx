"use client"

import { CaretDownIcon, CaretUpDownIcon, CircleNotchIcon, CopySimpleIcon, DotsThreeIcon, EyeIcon, EyeSlashIcon, FileTextIcon, CardsIcon, FilmStripIcon, ListChecksIcon, LockIcon, LockOpenIcon, PencilSimpleIcon, PlayCircleIcon, PlusIcon, StackIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { CourseBatchBadges } from "@/components/course-badges"
import { DeckSummary } from "@/components/flashcard-links"
import { FlashcardDeckPanel } from "@/components/flashcard-deck"
import { LessonNotes } from "@/components/note-list"
import { PdfPreview } from "@/components/pdf-preview"
import { QuizCreator } from "@/components/quiz-pdf-import"
import { QuizList } from "@/components/quiz-list"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { VideoList, VideoSection } from "@/components/video-section"
import { cn } from "@/lib/utils"
import { useScrollIntoView } from "@/hooks/use-scroll-into-view"
import { useUser } from "@/hooks/use-user"
import {
  UUID_RE,
  batchLabel,
  createCourseBatch,
  createLesson,
  deleteCourse,
  deleteLesson,
  downloadNote,
  getCourse,
  listExams,
  listCourseDecks,
  listCourseVideos,
  listLessons,
  listQuizzes,
  updateCourse,
  updateCourseStatus,
  updateCourseVisibility,
  updateLesson,
  type Course as CourseT,
  type CourseStatus,
  type Exam,
  type FlashcardDeck,
  type Lesson,
  type Note,
  TIER_LABEL,
  type Quiz,
  type Tier,
  type Video,
  type VideoKind,
} from "@/lib/api"


const slugOk = "[a-z0-9]+(-[a-z0-9]+)*"

export default function CoursePage() {
  return (
    <AppShell>
      <Suspense>
        <CourseView />
      </Suspense>
    </AppShell>
  )
}

function CourseView() {
  const user = useUser()!
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const fromExplore = useSearchParams().get("from") === "explore"
  const valid = UUID_RE.test(id)
  const [course, setCourse] = useState<CourseT | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [loading, setLoading] = useState(valid)
  const [error, setError] = useState<string | null>(valid ? null : "That is not a valid course ID.")
  const [mode, setMode] = useState<"lesson" | "edit" | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [startingBatch, setStartingBatch] = useState(false)

  // Only the course owner (its instructor, or an admin who is its instructor) can manage it.
  const isOwner = !!course && user.role !== "student" && course.instructorId === user.id
  // An admin who doesn't own the course can read it but has no access to its lessons.
  const canSeeLessons = !!course && (user.role !== "admin" || isOwner)

  const load = useCallback(async () => {
    setError(null)
    try {
      const c = await getCourse(id)
      setCourse(c)
      if (user.role !== "admin" || c.instructorId === user.id) {
        // One request for every deck of the course; the flashcards are optional, so a failure here is not fatal.
        const [ls, vs, ds] = await Promise.all([listLessons(id), listCourseVideos(id), listCourseDecks(id).catch(() => [])])
        setLessons(ls)
        setVideos(vs)
        setDecks(ds)
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [id, user.id, user.role])

  useEffect(() => {
    if (!valid) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [valid, load])

  async function onStatus(next: CourseStatus) {
    setError(null)
    try {
      const c = await updateCourseStatus(id, next)
      setCourse((cur) => (cur ? { ...cur, status: c.status } : cur))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  // Private keeps the course open to the students enrolled now and hides it from everyone else.
  async function onVisibility() {
    if (!course) return
    const next = course.visibility === "private" ? "public" : "private"
    const question =
      next === "private"
        ? `Make "${course.title}" private? Students enrolled now keep access until their enrollment ends. Nobody else will see it.`
        : `Make "${course.title}" public again? Every student will be able to find it in Explore.`
    if (!confirm(question)) return
    setError(null)
    try {
      const c = await updateCourseVisibility(id, next)
      setCourse((cur) => (cur ? { ...cur, visibility: c.visibility } : cur))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  async function onNewBatch() {
    if (
      !course ||
      !confirm(
        `Start a new batch of "${course.title}"? Its lessons, PDF notes, offline recordings, tests and flashcards are copied into a new draft course. Meet recordings and students stay here.`
      )
    )
      return
    setError(null)
    setStartingBatch(true)
    try {
      const c = await createCourseBatch(id)
      router.push(`/courses/${c.id}`)
    } catch (e) {
      setError(errMsg(e))
      setStartingBatch(false)
    }
  }

  async function onDelete() {
    if (!course || !confirm(`Delete "${course.title}"? Students will lose access to it.`)) return
    setError(null)
    try {
      await deleteCourse(id)
      router.replace(user.role === "admin" ? "/courses" : "/feed")
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const readyVideos = videos.filter((v) => v.status === "ready").length
  // Not enrolled in a paid course: only free lessons, notes, quizzes and videos open.
  const preview = course?.access === "preview"
  // My tier in this course: unenrolled previewers are free; enrolled students have the tier they were enrolled on.
  const tier: Tier = course?.tier ?? "free"
  const playable = videos.filter((v) => v.status === "ready" && !v.locked).length
  const freeLessons = lessons.filter((l) => !l.locked).length
  const learnHref = `/courses/${id}/learn?from=course${fromExplore ? "&via=explore" : ""}`
  const linkQuery = fromExplore ? "from=course&via=explore" : "from=course"
  // Each lesson card manages its own slice of the course's videos.
  const setLessonVideos = (lessonId: string) => (fn: (v: Video[]) => Video[]) =>
    setVideos((all) => [...all.filter((v) => v.lessonId !== lessonId), ...fn(all.filter((v) => v.lessonId === lessonId))])

  // A lesson's deck, or the course-wide one (lessonId null). A null deck means it was deleted or never created.
  const deckOf = (lessonId: string | null) => decks.find((d) => d.lessonId === lessonId) ?? null
  const setDeckOf = (lessonId: string | null) => (deck: FlashcardDeck | null) =>
    setDecks((ds) => [...ds.filter((d) => d.lessonId !== lessonId), ...(deck ? [deck] : [])])

  const patchLesson = (lessonId: string, fn: (l: Lesson) => Lesson) =>
    setLessons((ls) => ls.map((l) => (l.id === lessonId ? fn(l) : l)))

  return (
    <>
      <PageTitle
        back={
          user.role === "admin"
            ? { href: "/courses", label: "All courses" }
            : fromExplore || preview
              ? { href: "/explore", label: "Explore courses" }
              : { href: "/feed", label: user.role === "student" ? "Dashboard" : "My classroom" }
        }
        title={course?.title ?? "Course"}
        eyebrow={courseEyebrow(course, isOwner || user.role === "admin")}
        subtitle={
          isOwner
            ? "Manage lessons, share PDF notes and publish tests."
            : course?.shortDescription || "Lessons, notes and tests for this course."
        }
        actions={
          isOwner ? (
            // Phones: "Add lesson" across the top, the rest in a tidy two-column grid.
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              {readyVideos > 0 && (
                <Link href={learnHref} className={buttonVariants({ variant: "outline" })}>
                  <PlayCircleIcon /> Preview player
                </Link>
              )}
              <Select aria-label="Course status" className="h-9 w-full sm:w-36 md:hidden" value={course.status} onChange={(e) => onStatus(e.target.value as CourseStatus)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
              <StatusControl value={course.status} onChange={onStatus} />
              <Button variant="outline" onClick={() => setMode(mode === "edit" ? null : "edit")}>
                <PencilSimpleIcon /> Edit
              </Button>
              <Button variant="outline" onClick={onVisibility}>
                {course.visibility === "private" ? <EyeIcon /> : <EyeSlashIcon />}
                {course.visibility === "private" ? "Make public" : "Make private"}
              </Button>
              <Button variant="outline" onClick={onNewBatch} disabled={startingBatch}>
                {startingBatch ? <CircleNotchIcon className="animate-spin" /> : <CopySimpleIcon />} New batch
              </Button>
              <Button variant="destructive" onClick={onDelete} className="md:border-black/[0.1] md:shadow-[0_1px_1px_rgba(0,0,0,0.04)] md:hover:border-destructive/30 md:hover:bg-destructive/[0.06]">
                <TrashIcon /> Delete
              </Button>
              <Button className="col-span-2 max-sm:order-first" onClick={() => setMode(mode === "lesson" ? null : "lesson")}>
                <PlusIcon /> Add lesson
              </Button>
            </div>
          ) : (
            canSeeLessons &&
            playable > 0 && (
              <Link href={learnHref} className={buttonVariants({ variant: "navy", size: "lg" }) + " max-sm:w-full"}>
                <PlayCircleIcon /> {preview ? "Watch free preview" : "Start learning"}
              </Link>
            )
          )
        }
      />

      <ErrorNote error={error} />

      {preview && canSeeLessons && (
        <div className="rise flex flex-wrap items-center gap-4 rounded-lg border border-secondary bg-lime-soft/50 p-4 sm:p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-navy">
            <LockOpenIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-semibold text-heading">You&apos;re previewing this course</p>
            <p className="tnum text-sm text-heading/80">
              {freeLessons} of {lessons.length} {lessons.length === 1 ? "lesson is" : "lessons are"} free to preview, along with any free videos and
              tests.
            </p>
          </div>
        </div>
      )}

      {course && (
        <div className="rise grid gap-6 rounded-lg border border-border bg-white p-4 shadow-[0_1px_2px_rgba(10,37,64,0.05)] sm:p-6 md:gap-0 md:overflow-hidden md:rounded-2xl md:border-0 md:p-0 md:shadow-(--shadow-surface)" style={{ "--i": 1 } as React.CSSProperties}>
          <div className={cn("space-y-3 md:order-2 md:px-8 md:py-6", !course.description && isOwner && !course.isFree && "md:hidden")}>
            <div className={cn("flex flex-wrap items-center gap-2", isOwner && !course.isFree && "md:hidden")}>
              <Badge variant={course.status === "published" ? "default" : "secondary"} className={cn(isOwner && "md:hidden")}>{course.status}</Badge>
              {course.isFree && <Badge variant="lime">Free</Badge>}
              <CourseBatchBadges course={course} showPrivate={isOwner || user.role === "admin"} />
              {preview && <Badge variant="secondary">Preview</Badge>}
              {!isOwner && course.access === "full" && !course.isFree && <Badge variant="lime">Your plan: {TIER_LABEL[tier]}</Badge>}
              {user.role === "admin" && !isOwner && <Badge variant="secondary">Owned by another instructor</Badge>}
            </div>
            {course.description && <Description text={course.description} />}
          </div>
          {canSeeLessons && (
            // Desktop: one strip of facts across the top, like the info bar on an App Store page.
            <dl className="flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-4 md:order-1 md:flex-nowrap md:gap-0 md:divide-x md:divide-black/[0.07] md:border-t-0 md:border-b md:border-black/[0.07] md:py-5">
              {[
                { label: "Lessons", value: lessons.length },
                { label: "Videos", value: isOwner ? videos.length : readyVideos },
                { label: "Notes", value: lessons.reduce((n, l) => n + (l.notes?.length ?? 0), 0) },
                ...(isOwner ? [{ label: "In draft", value: lessons.filter((l) => !l.isPublished).length, desk: true }] : []),
              ].map(({ label, value, desk }: { label: string; value: number; desk?: boolean }) => (
                <div key={label} className={cn("md:flex md:flex-1 md:flex-col md:items-center md:px-4", desk && "max-md:hidden")}>
                  <dt className="text-xs text-muted-foreground md:text-[11px] md:font-semibold md:tracking-[0.06em] md:text-heading/45 md:uppercase">{label}</dt>
                  <dd className="tnum text-3xl font-semibold text-heading md:mt-1 md:text-[1.375rem] md:leading-none md:tracking-[-0.02em] md:text-heading/85">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {isOwner && mode === "edit" && course && (
        <EditCourse
          course={course}
          onSaved={(c) => {
            setCourse(c)
            setMode(null)
          }}
        />
      )}
      {isOwner && mode === "lesson" && (
        <NewLesson
          courseId={id}
          onCreated={() => {
            setMode(null)
            load()
          }}
        />
      )}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <CircleNotchIcon className="size-4 animate-spin" /> Loading…
        </p>
      )}
      {course && !canSeeLessons && (
        <Card className="bg-white">
          <CardContent className="py-8 text-center text-sm text-gray-500">
            Lessons, notes and tests are managed by the course&apos;s instructor.
          </CardContent>
        </Card>
      )}
      {!loading && !error && canSeeLessons && lessons.length === 0 && (
        <Card className="bg-white">
          <CardContent className="py-10 text-center text-sm text-gray-500">
            {isOwner ? "No lessons yet. Add the first one." : "No lessons have been published yet."}
          </CardContent>
        </Card>
      )}

      {canSeeLessons && lessons.length > 0 && (
      <section className="space-y-8 sm:space-y-10 md:space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 pt-2 md:px-1 md:pb-1">
          <div>
            <h2 className="text-2xl font-semibold text-heading md:text-[1.375rem] md:tracking-[-0.02em]">Course content</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="md:h-7 md:border-0 md:bg-transparent md:px-2 md:text-[13px] md:font-medium md:text-primary md:shadow-none md:hover:bg-black/[0.04] md:[&_svg]:hidden"
            onClick={() => setOpenIds(openIds.size === lessons.length ? new Set() : new Set(lessons.map((l) => l.id)))}
          >
            <CaretUpDownIcon />
            {openIds.size === lessons.length ? "Collapse all" : "Expand all"}
          </Button>
        </div>
        <div className="space-y-8 sm:space-y-10 md:space-y-2.5">
        {lessons.map((l, i) => (
          <LessonCard
            key={l.id}
            linkQuery={linkQuery}
            open={openIds.has(l.id)}
            setOpen={(v) =>
              setOpenIds((cur) => {
                const next = new Set(cur)
                const on = typeof v === "function" ? v(cur.has(l.id)) : v
                if (on) next.add(l.id)
                else next.delete(l.id)
                return next
              })
            }
            index={i + 1}
            lesson={l}
            isOwner={isOwner}
            videos={videos.filter((v) => v.lessonId === l.id)}
            setVideos={setLessonVideos(l.id)}
            deck={deckOf(l.id)}
            courseDeck={deckOf(null)}
            onDeckChange={setDeckOf(l.id)}
            tier={tier}
            onChange={(fn) => patchLesson(l.id, fn)}
            onDeleted={() => {
              setLessons((ls) => ls.filter((x) => x.id !== l.id))
              setDeckOf(l.id)(null)
            }}
          />
        ))}
        </div>
      </section>
      )}

      {canSeeLessons && (isOwner || (deckOf(null)?.cardCount ?? 0) > 0) && (
        <section className="space-y-3 pt-2 md:space-y-2.5">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-heading md:px-1 md:text-[1.375rem] md:tracking-[-0.02em]">
            <CardsIcon className="size-6 text-teal md:hidden" />
            Course-wide flashcards
          </h2>
          <div className="rounded-lg border border-border bg-white p-4 shadow-[0_1px_2px_rgba(10,37,64,0.05)] sm:p-6 md:rounded-2xl md:border-transparent md:px-6 md:py-5 md:shadow-(--shadow-surface)">
            {isOwner ? (
              <FlashcardDeckPanel courseId={id} lessonId={null} deck={deckOf(null)} onChange={setDeckOf(null)} />
            ) : (
              <DeckSummary deck={deckOf(null)} tier={tier} title="Course-wide flashcards" />
            )}
          </div>
        </section>
      )}
    </>
  )
}

function EditCourse({ course, onSaved }: { course: CourseT; onSaved: (c: CourseT) => void }) {
  const cardRef = useScrollIntoView<HTMLDivElement>()
  const [exams, setExams] = useState<Exam[]>([])
  const [form, setForm] = useState({
    title: course.title,
    slug: course.slug,
    shortDescription: course.shortDescription,
    description: course.description,
    examId: course.examId,
    isFree: course.isFree,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    listExams().then(setExams).catch((e) => setError(errMsg(e)))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      onSaved(await updateCourse(course.id, { ...form, title: form.title.trim(), slug: form.slug.trim() }))
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <Card ref={cardRef} className="rise scroll-mt-20 bg-white">
      <CardHeader>
        <CardTitle>Edit course</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ce-exam">Exam</FieldLabel>
            <Select id="ce-exam" value={form.examId} onChange={(e) => set("examId", e.target.value)}>
              {exams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ce-title">Title</FieldLabel>
            <Input id="ce-title" required maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ce-slug">Slug</FieldLabel>
            <Input id="ce-slug" required maxLength={200} pattern={slugOk} title="Lowercase letters, numbers and single dashes" value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ce-short">Short description</FieldLabel>
            <Input id="ce-short" maxLength={500} value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ce-desc">Description</FieldLabel>
            <Textarea id="ce-desc" maxLength={10000} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
            <input type="checkbox" checked={form.isFree} onChange={(e) => set("isFree", e.target.checked)} />
            Free course
          </label>
          <div className="space-y-3 sm:col-span-2">
            <ErrorNote error={error} />
            <Button type="submit" disabled={saving} className="max-sm:w-full">
              {saving && <CircleNotchIcon className="animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function NewLesson({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
  const cardRef = useScrollIntoView<HTMLDivElement>()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isFree, setIsFree] = useState(false)
  const [isPublished, setPublished] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await createLesson(courseId, { title: title.trim(), content: content.trim(), isFree, isPublished })
      onCreated()
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <Card ref={cardRef} className="rise scroll-mt-20 bg-white">
      <CardHeader>
        <CardTitle>New lesson</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="ltitle">Title</FieldLabel>
            <Input id="ltitle" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lcontent">Short description</FieldLabel>
            <Textarea id="lcontent" maxLength={50000} value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-3 text-sm text-gray-700 sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isPublished} onChange={(e) => setPublished(e.target.checked)} />
              Published (visible to students)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
              Free preview
            </label>
          </div>
          <ErrorNote error={error} />
          <Button type="submit" disabled={saving} className="max-sm:w-full">
            {saving && <CircleNotchIcon className="animate-spin" />}
            Create lesson
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function LessonCard({
  open: open_,
  setOpen,
  index,
  lesson,
  isOwner,
  videos,
  setVideos,
  onChange,
  onDeleted,
  deck,
  courseDeck,
  onDeckChange,
  tier,
  linkQuery,
}: {
  open: boolean
  setOpen: (v: boolean | ((c: boolean) => boolean)) => void
  index: number
  lesson: Lesson
  isOwner: boolean
  videos: Video[]
  setVideos: (fn: (v: Video[]) => Video[]) => void
  onChange: (fn: (l: Lesson) => Lesson) => void
  onDeleted: () => void
  deck: FlashcardDeck | null
  /** The course-wide deck, shown to students in a lesson that has no deck of its own. */
  courseDeck: FlashcardDeck | null
  onDeckChange: (deck: FlashcardDeck | null) => void
  /** The viewer's tier in the course. Free = not enrolled: only free items open. */
  tier: Tier
  linkQuery: string
}) {
  const [preview, setPreview] = useState<Note | null>(null)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<"quiz" | "video-offline" | "video-meet" | "edit" | null>(null)
  // Desktop shows one kind of lesson content at a time; until the instructor picks, open on the first with something in it.
  const [tabChoice, setTabChoice] = useState<LessonTab | null>(null)
  const notes = lesson.notes ?? []
  const locked = !!lesson.locked
  const free = (x: { tiers: readonly string[] }) => x.tiers.includes("free")
  // What a viewer who isn't the owner can do in this lesson: some of it may be free (or open on their plan) even when the lesson itself is locked.
  const hasFree =
    lesson.isFree ||
    notes.some(free) ||
    videos.some((v) => v.status === "ready" && free(v)) ||
    quizzes.some(free) ||
    (deck?.freeCardCount ?? 0) > 0
  const hasOpen =
    !locked ||
    notes.some((n) => !n.locked) ||
    videos.some((v) => v.status === "ready" && !v.locked) ||
    quizzes.some((q) => !q.locked) ||
    (deck?.accessibleCardCount ?? 0) > 0
  const showLock = isOwner ? locked : tier === "free" ? !hasFree : !hasOpen
  // Previewers see whether the lesson has anything free; enrolled students only hear about a lesson that is shut.
  const access =
    tier === "free" ? (
      // Nothing free: the lock in place of the lesson number is all a previewer sees.
      hasFree && <Badge variant="lime">Free preview</Badge>
    ) : (
      !hasOpen && <Badge variant="outline">Not on your plan</Badge>
    )
  const setNotes = (fn: (n: Note[]) => Note[]) => onChange((l) => ({ ...l, notes: fn(l.notes ?? []) }))
  // Students get the lesson's own deck, else the course-wide one; with neither the Flashcards section is left out.
  const hasCards = (d: FlashcardDeck | null): d is FlashcardDeck => !!d && d.cardCount > 0
  const studyDeck = hasCards(deck) ? deck : hasCards(courseDeck) ? courseDeck : null
  const showCards = isOwner || !!studyDeck
  const tabs: { value: LessonTab; label: string; count: number }[] = [
    { value: "recordings", label: "Recordings", count: videos.length },
    { value: "tests", label: "Tests", count: quizzes.length },
    { value: "notes", label: "Notes", count: notes.length },
    ...(showCards ? [{ value: "flashcards" as const, label: "Flashcards", count: (studyDeck ?? deck)?.cardCount ?? 0 }] : []),
  ]
  const tab = tabChoice ?? tabs.find((t) => t.count > 0)?.value ?? "recordings"
  /** Hidden on desktop unless it is the chosen tab; phones always show every section. */
  const only = (t: LessonTab) => (tab === t ? "" : "md:hidden")

  useEffect(() => {
    listQuizzes(lesson.id).then(setQuizzes).catch((e) => setError(errMsg(e)))
  }, [lesson.id])

  async function togglePublished() {
    setError(null)
    try {
      const l = await updateLesson(lesson.id, { isPublished: !lesson.isPublished })
      onChange((x) => ({ ...x, isPublished: l.isPublished }))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  async function removeLesson() {
    if (!confirm(`Delete lesson "${lesson.title}"? Its notes and PDFs will be removed.`)) return
    setError(null)
    try {
      await deleteLesson(lesson.id)
      onDeleted()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  // Students preview inside the app only (no file URL, no download); owners keep the plain open-in-tab flow.
  async function open(n: Note) {
    setError(null)
    if (!isOwner) return setPreview(n)
    try {
      const url = URL.createObjectURL(await downloadNote(n.id))
      window.open(url, "_blank", "noopener")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <article
      className={cn(
        "rise group/lesson overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(10,37,64,0.05)] transition-shadow duration-200",
        // Desktop: each lesson is its own quiet card; an open one gains a touch more depth so it reads as in focus.
        "md:rounded-2xl md:border-0 md:shadow-(--shadow-surface) md:duration-300",
        open_ && "md:shadow-(--shadow-lifted)"
      )}
      style={{ "--i": Math.min(index, 6) } as React.CSSProperties}
    >
      <div className="flex flex-col gap-3 p-4 transition-colors has-[>button:active]:bg-gray-50 sm:flex-row sm:items-center sm:gap-4 sm:p-6 md:gap-2 md:py-3 md:pr-3 md:pl-5 md:transition-colors md:duration-150 md:hover:bg-black/[0.018]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open_}
          aria-controls={`lesson-${lesson.id}`}
          className="group flex w-full min-w-0 touch-manipulation items-center gap-3 rounded-md text-left sm:flex-1 sm:gap-4 md:items-start md:gap-3 md:focus-visible:outline-offset-4"
        >
          {showLock ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500" aria-label="Locked">
              <LockIcon className="size-4.5" />
            </span>
          ) : (
            <span
              className={cn(
                "tnum flex size-11 shrink-0 items-center justify-center rounded-full bg-teal text-base font-semibold text-white transition-[transform,background-color,color] duration-200 group-hover:scale-105",
                // Desktop: just the lesson's number, quiet and right-aligned, as a list index.
                "md:h-[22px] md:w-6 md:justify-end md:rounded-none md:bg-transparent md:text-[15px] md:leading-[22px] md:font-medium md:text-heading/35 md:group-hover:scale-100"
              )}
            >
              {index}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-base font-semibold break-words text-heading sm:truncate sm:text-lg md:text-[15px] md:leading-[22px] md:tracking-[-0.01em]">{lesson.title}</span>
            {/* A student's access badge lives inside the button, so tapping anywhere on the header opens the lesson. */}
            {!isOwner && access && <span className="mt-1.5 flex">{access}</span>}
            {isOwner && (!lesson.isPublished || lesson.isFree) && (
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {!lesson.isPublished && <Badge variant="secondary" className="md:bg-black/[0.06] md:text-heading/60">Draft</Badge>}
                {lesson.isFree && <Badge variant="lime">Free preview</Badge>}
              </span>
            )}
            <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs whitespace-nowrap text-muted-foreground md:mt-0.5 md:gap-x-0 md:text-[13px] md:text-heading/45 md:[&_svg]:hidden md:[&>span]:gap-0 md:[&>span+span]:before:mx-1.5 md:[&>span+span]:before:content-['·']">
              <span className="flex items-center gap-1.5"><FileTextIcon className="size-3.5" />{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
              <span className="flex items-center gap-1.5"><ListChecksIcon className="size-3.5" />{quizzes.length} {quizzes.length === 1 ? "test" : "tests"}</span>
              <span className="flex items-center gap-1.5"><FilmStripIcon className="size-3.5" />{videos.length} {videos.length === 1 ? "video" : "videos"}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center justify-center md:order-first md:-ml-1 md:h-[22px] md:w-5">
            <CaretDownIcon weight="bold" className={"size-5 shrink-0 text-heading/60 transition-transform duration-300 ease-(--ease-out) md:size-3 md:text-heading/35 " + (open_ ? "rotate-180 md:rotate-0" : "md:-rotate-90")} />
          </span>
        </button>
        {isOwner && (
          <div className="flex shrink-0 items-center gap-1 max-sm:pl-14 md:hidden">
            <Button variant="outline" size="sm" onClick={togglePublished}>
              {lesson.isPublished ? <EyeSlashIcon /> : <EyeIcon />}
              {lesson.isPublished ? "Unpublish" : "Publish"}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${lesson.title}`} onClick={() => { setOpen(true); setPanel(panel === "edit" ? null : "edit") }}>
              <PencilSimpleIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${lesson.title}`} className="hover:bg-destructive/10 hover:text-destructive" onClick={removeLesson}>
              <TrashIcon />
            </Button>
          </div>
        )}
        {/* Desktop: the lesson's tools live behind one ⋯ button, as in Finder or Mail. */}
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${lesson.title}`}
                  className="shrink-0 rounded-full text-heading/45 hover:bg-black/[0.05] hover:text-heading data-popup-open:bg-black/[0.06] max-md:hidden"
                />
              }
            >
              <DotsThreeIcon weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="w-44 p-1">
              <DropdownMenuItem className="h-8 px-2.5" onClick={() => { setOpen(true); setPanel("edit") }}>
                Edit Lesson…
              </DropdownMenuItem>
              <DropdownMenuItem className="h-8 px-2.5" onClick={togglePublished}>
                {lesson.isPublished ? "Unpublish" : "Publish"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="h-8 px-2.5" onClick={removeLesson}>
                Delete Lesson…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="expand" data-open={open_} id={`lesson-${lesson.id}`}>
        <div>
          <div className="space-y-6 border-t border-border bg-gray-50/60 p-4 sm:p-6 md:space-y-5 md:border-black/[0.06] md:bg-[#f8f8fa] md:px-6 md:pt-5 md:pb-6">
            {lesson.content && (
              <p className="max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-wrap text-gray-700 md:px-1 md:text-[14px] md:text-heading/70">{lesson.content}</p>
            )}
            <ErrorNote error={error} />

            <DeskSegmented label="Lesson content" value={tab} options={tabs} onChange={setTabChoice} />

            {isOwner && panel === "edit" && (
              <EditLesson
                lesson={lesson}
                onSaved={(l) => {
                  onChange((x) => ({ ...x, title: l.title, content: l.content, isFree: l.isFree, isPublished: l.isPublished }))
                  setPanel(null)
                }}
              />
            )}

            {!isOwner && (
              <div className={only("recordings")}>
                <VideoList videos={videos} tier={tier} linkQuery={linkQuery} />
              </div>
            )}
            {isOwner && (
              <div className={only("recordings")}>
              <VideoSection
                lessonId={lesson.id}
                videos={videos}
                setVideos={setVideos}
                formKind={panel === "video-offline" ? "offline" : panel === "video-meet" ? "meet" : null}
                setFormKind={(k: VideoKind | null) => setPanel(k ? `video-${k}` : null)}
              />
              </div>
            )}

            <div className="grid gap-6 md:block">
              <section className={cn("space-y-3", only("notes"))}>
                <PanelHead icon={StackIcon} title="Notes" count={notes.length} />
                <LessonNotes
                  lessonId={lesson.id}
                  notes={notes}
                  setNotes={setNotes}
                  isOwner={isOwner}
                  onOpen={open}
                  tier={tier}
                  inset
                  empty={
                    <p className="rounded-md border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-muted-foreground">
                      No notes shared yet.
                    </p>
                  }
                />
              </section>

              <section className={cn("space-y-3 md:space-y-4", only("tests"))}>
                <PanelHead icon={ListChecksIcon} title="Tests" count={quizzes.length} />
                <div className="inset-box flex flex-col gap-3 md:gap-0">
                  {quizzes.length === 0 && (
                    <p className="rounded-md border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-muted-foreground">
                      No tests yet.
                    </p>
                  )}
                  <QuizList quizzes={quizzes} tier={tier} owner={isOwner} linkQuery={linkQuery} inset />
                  {isOwner && panel !== "quiz" && (
                    <button type="button" className="inset-add" onClick={() => setPanel("quiz")}>
                      <PlusIcon weight="bold" /> New test
                    </button>
                  )}
                </div>
                {isOwner && (
                  <Button variant="outline" size="sm" className="md:hidden" onClick={() => setPanel(panel === "quiz" ? null : "quiz")}>
                    <PlusIcon /> Create test
                  </Button>
                )}
                {isOwner && panel === "quiz" && (
                  <QuizCreator
                    lessonId={lesson.id}
                    onSaved={(q) => setQuizzes((qs) => [...qs, q])}
                    onClose={() => setPanel(null)}
                  />
                )}
              </section>

              {showCards && (
                <section className={cn("space-y-3", only("flashcards"))}>
                  <PanelHead icon={CardsIcon} title="Flashcards" count={deck?.cardCount} />
                  {isOwner ? (
                    <div className="inset-box md:p-3.5">
                      <FlashcardDeckPanel courseId={lesson.courseId} lessonId={lesson.id} deck={deck} onChange={onDeckChange} />
                    </div>
                  ) : (
                    <DeckSummary
                      deck={studyDeck}
                      tier={tier}
                      title={studyDeck === deck ? `${lesson.title} flashcards` : "Course-wide flashcards"}
                    />
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
      {preview && <PdfPreview title={preview.title} load={() => downloadNote(preview.id)} onClose={() => setPreview(null)} />}
    </article>
  )
}

/** Desktop section header: a small label, a quiet count and an optional text action on the right. Phones keep the icon + label. */
function PanelHead({
  icon: PanelIcon,
  title,
  count,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count?: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 md:hidden">
      <h3 className="flex items-center gap-2 text-sm font-medium text-heading">
        <PanelIcon className="size-4 text-teal md:hidden" />
        {title}
        {!!count && <span className="tnum hidden font-normal text-heading/35 md:inline">{count}</span>}
      </h3>
      {action && <span className="max-md:hidden">{action}</span>}
    </div>
  )
}

type LessonTab = "recordings" | "tests" | "notes" | "flashcards"

/** Desktop segmented control, as macOS shows a small set of exclusive choices: a gray track and a white thumb that slides. */
function DeskSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
  segment = "w-[7.25rem]",
  track = "h-9",
}: {
  label: string
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
  /** Width of each segment; segments are equal so the thumb can slide by its own width. */
  segment?: string
  /** Track height, to match the controls beside it. */
  track?: string
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="radiogroup" aria-label={label} className={cn("relative inline-flex items-center rounded-[10px]", track, " bg-black/[0.055] p-[3px] max-md:hidden")}>
      <span
        aria-hidden="true"
        className="absolute inset-y-[3px] left-[3px] rounded-[7px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-(--ease-drawer)"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && onChange(o.value)}
            className={cn(
              "relative z-10 flex h-full items-center justify-center gap-1.5 rounded-[7px] text-[13px] transition-colors duration-200",
              segment,
              active ? "font-semibold text-heading" : "font-medium text-heading/55 hover:text-heading/80"
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn("tnum text-[12px] font-medium", active ? "text-heading/45" : "text-heading/30")}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Desktop: the three course states as one segmented control. */
/** The line above the title: "Batch 2.0" on a later batch, plus "Private" for the people who manage the course. */
function courseEyebrow(course: CourseT | null, canManage: boolean) {
  if (!course) return undefined
  const batch = batchLabel(course)
  const parts = [batch && `Batch ${batch}`, canManage && course.visibility === "private" && "Private"].filter(Boolean)
  return parts.length ? parts.join(" · ") : undefined
}

function StatusControl({ value, onChange }: { value: CourseStatus; onChange: (v: CourseStatus) => void }) {
  return (
    <DeskSegmented
      label="Course status"
      value={value}
      segment="w-[5.75rem]"
      track="h-10"
      options={[
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "archived", label: "Archived" },
      ]}
      onChange={onChange}
    />
  )
}

/** A long course description: desktop shows the first lines and a toggle; phones keep the full text. */
function Description({ text }: { text: string }) {
  const [more, setMore] = useState(false)
  const long = text.length > 420 || text.split("\n").length > 8
  return (
    <div className="space-y-2">
      <p
        className={cn(
          "max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-wrap text-gray-700 md:leading-[1.6] md:text-heading/75",
          long && !more && "md:line-clamp-6"
        )}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="hidden text-sm font-medium text-primary transition-opacity hover:opacity-75 active:opacity-50 md:inline"
        >
          {more ? "less" : "more"}
        </button>
      )}
    </div>
  )
}

function EditLesson({ lesson, onSaved }: { lesson: Lesson; onSaved: (l: Lesson) => void }) {
  const formRef = useScrollIntoView<HTMLFormElement>()
  const [title, setTitle] = useState(lesson.title)
  const [content, setContent] = useState(lesson.content)
  const [isFree, setIsFree] = useState(lesson.isFree)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      onSaved(await updateLesson(lesson.id, { title: title.trim(), content: content.trim(), isFree }))
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="scroll-mt-20 space-y-3 rounded-lg border border-border bg-white p-5 shadow-sm">
      <Field>
        <FieldLabel htmlFor={`el-${lesson.id}`}>Title</FieldLabel>
        <Input id={`el-${lesson.id}`} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`ec-${lesson.id}`}>Short description</FieldLabel>
        <Textarea id={`ec-${lesson.id}`} maxLength={50000} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        Free preview
      </label>
      <ErrorNote error={error} />
      <Button type="submit" disabled={saving} className="max-sm:w-full">
        {saving && <CircleNotchIcon className="animate-spin" />}
        Save lesson
      </Button>
    </form>
  )
}
