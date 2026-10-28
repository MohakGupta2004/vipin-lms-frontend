"use client"

import { ArrowRightIcon, CheckIcon, CircleNotchIcon, CopyIcon, PlusIcon, UsersIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { CourseBatchBadges } from "@/components/course-badges"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { useScrollIntoView } from "@/hooks/use-scroll-into-view"
import { useUser } from "@/hooks/use-user"
import { Textarea } from "@/components/ui/textarea"
import {
  createCourse,
  listCourses,
  listExams,
  listUsers,
  type Course,
  type CourseStatus,
  type Exam,
  type UserSummary,
} from "@/lib/api"

const PAGE = 20

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

export default function CoursesPage() {
  return (
    <AppShell roles={["admin"]}>
      <Courses />
    </AppShell>
  )
}

function Courses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const me = useUser()!
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  const load = useCallback(async (off: number) => {
    setLoading(true)
    setError(null)
    try {
      // Fetch one extra row to know whether a next page exists.
      const rows = await listCourses(PAGE + 1, off)
      setHasMore(rows.length > PAGE)
      setCourses(rows.slice(0, PAGE))
      setOffset(off)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(0)
    listExams().then(setExams).catch((e) => setError(errMsg(e)))
    listUsers().then(setUsers).catch((e) => setError(errMsg(e)))
  }, [load])

  const examName = (id: string) => exams.find((x) => x.id === id)?.name ?? "—"
  const person = (id: string) => {
    if (id === me.id) return "You"
    const u = users.find((x) => x.id === id)
    return u ? `${u.firstName} ${u.lastName}` : id
  }
  const eligible = users.filter((u) => u.role === "instructor" || u.role === "admin")

  return (
    <>
      <PageTitle
        title="Courses"
        subtitle="Every course on the platform. Courses you own can be edited, published and filled with lessons, notes and tests."
        actions={
          <Button onClick={() => setCreating((v) => !v)}>
            <PlusIcon />
            {creating ? "Close" : "New course"}
          </Button>
        }
      />

      {creating && (
        <CreateCourse
          exams={exams}
          instructors={eligible}
          // Straight into the new course so lessons can be added; "All courses" there leads back here.
          onCreated={(c) => router.push(`/courses/${c.id}`)}
          onCancel={() => setCreating(false)}
        />
      )}

      <ErrorNote error={error} />

      <div className="space-y-3">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <CircleNotchIcon className="size-4 animate-spin" /> Loading courses…
          </p>
        )}
        {!loading && courses.length === 0 && !error && (
          <Card className="bg-white">
            <CardContent className="py-10 text-center text-sm text-gray-500">
              No courses yet. Create the first one.
            </CardContent>
          </Card>
        )}
        <div className="grid gap-6 md:grid-cols-2">
        {courses.map((c, i) => (
          <Card key={c.id} className="rise tap group relative gap-5 hover:border-teal/40 hover:shadow-sm" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
            <CardContent className="flex h-full flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={c.status === "published" ? "default" : "secondary"}>{c.status}</Badge>
                  {c.isFree && <Badge variant="lime">Free</Badge>}
                  <CourseBatchBadges course={c} showPrivate />
                </div>
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-heading/40 text-heading transition-colors duration-200 group-hover:border-teal group-hover:bg-teal group-hover:text-white"
                >
                  <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl leading-snug font-semibold text-heading">
                  {/* Stretched over the card, so a tap anywhere opens the course; the controls below sit above it. */}
                  <Link href={`/courses/${c.id}`} className="tap-link break-words after:absolute after:inset-0 after:rounded-xl">
                    {c.title}
                  </Link>
                </h2>
                {c.shortDescription && <p className="line-clamp-2 text-sm leading-relaxed text-gray-600">{c.shortDescription}</p>}
              </div>
              <dl className="grid gap-x-6 gap-y-2 border-t border-border pt-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Exam</dt>
                  <dd className="font-semibold text-heading">{examName(c.examId)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Instructor</dt>
                  <dd className="font-semibold text-heading">{person(c.instructorId)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Slug</dt>
                  <dd className="truncate font-semibold text-heading">{c.slug}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Course ID</dt>
                  <dd className="flex items-center gap-1 font-mono text-[11px] text-heading">
                    <span className="truncate">{c.id}</span>
                    <span className="relative z-10"><CopyButton text={c.id} label="Copy course ID" /></span>
                  </dd>
                </div>
              </dl>
              <div className="relative z-10 mt-auto flex flex-wrap gap-2">
                <Link href={`/courses/${c.id}`} className={buttonVariants({ size: "sm" })}>
                  {c.instructorId === me.id ? "Manage" : "View"}
                  <ArrowRightIcon />
                </Link>
                <Link
                  href={`/enrollments?courseId=${encodeURIComponent(c.id)}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <UsersIcon />
                  Enrollments
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      </div>

      {(offset > 0 || hasMore) && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={offset === 0 || loading} onClick={() => load(Math.max(0, offset - PAGE))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!hasMore || loading} onClick={() => load(offset + PAGE)}>
            Next
          </Button>
        </div>
      )}
    </>
  )
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
      className="inline-flex shrink-0 rounded-sm p-0.5 text-gray-400 transition-colors hover:bg-accent hover:text-teal"
    >
      {done ? <CheckIcon className="pop size-3.5 text-green-600" /> : <CopyIcon className="size-3.5" />}
    </button>
  )
}

function CreateCourse({
  exams,
  instructors,
  onCreated,
  onCancel,
}: {
  exams: Exam[]
  instructors: UserSummary[]
  onCreated: (c: Course) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [examId, setExamId] = useState("")
  const me = useUser()!
  // Defaults to the admin: the course owner can manage its lessons, notes and quizzes.
  const [instructorId, setInstructorId] = useState(me.id)
  const [shortDescription, setShort] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<CourseStatus>("draft")
  const [isFree, setIsFree] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useScrollIntoView<HTMLDivElement>()

  // Put the cursor in the first field of the freshly opened form.
  useEffect(() => document.getElementById("exam")?.focus({ preventScroll: true }), [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!examId) return setError("Choose the exam this course is for.")
    setSaving(true)
    try {
      const c = await createCourse({
        examId,
        instructorId,
        title: title.trim(),
        slug: slug.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        status,
        isFree,
      })
      onCreated(c)
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <Card ref={cardRef} className="rise scroll-mt-20 bg-white">
      <CardHeader>
        <CardTitle>New course</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="exam">Exam</FieldLabel>
            <Select id="exam" required value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">{exams.length ? "Select an exam…" : "Loading exams…"}</option>
              {exams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input
              id="title"
              required
              maxLength={200}
              value={title}
             
              onChange={(e) => {
                setTitle(e.target.value)
                if (!slugEdited) setSlug(slugify(e.target.value))
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="slug">Slug</FieldLabel>
            <Input
              id="slug"
              required
              maxLength={200}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Lowercase letters, numbers and single dashes"
              value={slug}
             
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugEdited(true)
              }}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="instructor">Instructor</FieldLabel>
            <Select id="instructor" required value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
              <option value={me.id}>Me ({me.firstName} {me.lastName})</option>
              {instructors
                .filter((u) => u.id !== me.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} — {u.email}
                  </option>
                ))}
            </Select>
            <p className="text-xs text-gray-500">The instructor owns the course and manages its lessons, notes and tests.</p>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="short">Short description</FieldLabel>
            <Input
              id="short"
              maxLength={500}
              value={shortDescription}
             
              onChange={(e) => setShort(e.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="desc">Description</FieldLabel>
            <Textarea id="desc" maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as CourseStatus)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
            Free course
          </label>
          <div className="space-y-3 sm:col-span-2">
            <ErrorNote error={error} />
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="max-sm:flex-1">
                {saving && <CircleNotchIcon className="animate-spin" />}
                Create course
              </Button>
              <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
