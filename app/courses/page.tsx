"use client"

import { Copy, Loader2, Plus, Users } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  UUID_RE,
  createCourse,
  listCourses,
  listExams,
  type Course,
  type CourseStatus,
  type Exam,
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
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
  }, [load])

  const examName = (id: string) => exams.find((x) => x.id === id)?.name ?? "—"

  return (
    <>
      <PageTitle
        title="Courses"
        subtitle="Every course on the platform. Status can be set when creating; afterwards only the course's instructor account can change it (open the course ID while signed in as that instructor)."
        actions={
          <Button onClick={() => setCreating((v) => !v)}>
            <Plus />
            {creating ? "Close" : "New course"}
          </Button>
        }
      />

      {creating && (
        <CreateCourse
          exams={exams}
          onCreated={() => {
            setCreating(false)
            load(0)
          }}
        />
      )}

      <ErrorNote error={error} />

      <div className="space-y-3">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Loading courses…
          </p>
        )}
        {!loading && courses.length === 0 && !error && (
          <Card className="bg-white">
            <CardContent className="py-10 text-center text-sm text-gray-500">
              No courses yet. Create the first one.
            </CardContent>
          </Card>
        )}
        {courses.map((c) => (
          <Card key={c.id} className="bg-white shadow-xs">
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium text-gray-900">{c.title}</div>
                  {c.shortDescription && (
                    <p className="text-sm text-gray-600">{c.shortDescription}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "published" ? "default" : "secondary"} className="capitalize">
                    {c.status}
                  </Badge>
                  {c.isFree && <Badge variant="outline">Free</Badge>}
                </div>
              </div>
              <dl className="grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium">Exam: </dt>
                  <dd className="inline">{examName(c.examId)}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Slug: </dt>
                  <dd className="inline">{c.slug}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline font-medium">Course ID: </dt>
                  <dd className="inline font-mono">{c.id}</dd>
                  <CopyButton text={c.id} label="Copy course ID" />
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline font-medium">Instructor ID: </dt>
                  <dd className="inline font-mono">{c.instructorId}</dd>
                </div>
              </dl>
              <Link
                href={`/enrollments?courseId=${encodeURIComponent(c.id)}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Users />
                Enrollments
              </Link>
            </CardContent>
          </Card>
        ))}
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
      className="ml-1 inline-flex align-middle text-gray-400 hover:text-gray-900"
    >
      {done ? <span className="text-green-600">copied</span> : <Copy className="size-3.5" />}
    </button>
  )
}

function CreateCourse({
  exams,
  onCreated,
}: {
  exams: Exam[]
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [examId, setExamId] = useState("")
  // The API only accepts a user with the instructor role as a course's instructor, so the admin's own
  // ID is rejected. The admin's linked instructor account (NEXT_PUBLIC_ADMIN_INSTRUCTOR_ID) is used instead.
  const [instructorId, setInstructorId] = useState(process.env.NEXT_PUBLIC_ADMIN_INSTRUCTOR_ID ?? "")
  const [shortDescription, setShort] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<CourseStatus>("draft")
  const [isFree, setIsFree] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!examId) return setError("Choose the exam this course is for.")
    if (!UUID_RE.test(instructorId.trim())) return setError("Enter the instructor ID.")
    setSaving(true)
    try {
      await createCourse({
        examId,
        instructorId: instructorId.trim(),
        title: title.trim(),
        slug: slug.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        status,
        isFree,
      })
      onCreated()
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <Card className="bg-white shadow-xs">
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
              className="h-10 bg-white"
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
              className="h-10 bg-white"
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugEdited(true)
              }}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="instructor">Instructor ID</FieldLabel>
            <Input
              id="instructor"
              required
              value={instructorId}
              className="h-10 bg-white font-mono"
              onChange={(e) => setInstructorId(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Prefilled with your instructor account. To add lessons, notes and quizzes, sign in with that account.
            </p>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="short">Short description</FieldLabel>
            <Input
              id="short"
              maxLength={500}
              value={shortDescription}
              className="h-10 bg-white"
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Create course
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
