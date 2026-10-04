"use client"

import { ClipboardList, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { QuizBuilder } from "@/components/quiz-builder"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/hooks/use-user"
import {
  UUID_RE,
  createLesson,
  deleteCourse,
  deleteLesson,
  deleteNote,
  downloadNote,
  getCourse,
  listExams,
  listLessons,
  listQuizzes,
  updateCourse,
  updateCourseStatus,
  updateLesson,
  uploadNote,
  type Course as CourseT,
  type CourseStatus,
  type Exam,
  type Lesson,
  type Note,
  type Quiz,
} from "@/lib/api"

const MAX_PDF = 25 * 1024 * 1024

const slugOk = "[a-z0-9]+(-[a-z0-9]+)*"

export default function CoursePage() {
  return (
    <AppShell>
      <CourseView />
    </AppShell>
  )
}

function CourseView() {
  const user = useUser()!
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const valid = UUID_RE.test(id)
  const [course, setCourse] = useState<CourseT | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(valid)
  const [error, setError] = useState<string | null>(valid ? null : "That is not a valid course ID.")
  const [mode, setMode] = useState<"lesson" | "edit" | null>(null)

  // Only the course owner (its instructor, or an admin who is its instructor) can manage it.
  const isOwner = !!course && user.role !== "student" && course.instructorId === user.id
  // An admin who doesn't own the course can read it but has no access to its lessons.
  const canSeeLessons = !!course && (user.role !== "admin" || isOwner)

  const load = useCallback(async () => {
    setError(null)
    try {
      const c = await getCourse(id)
      setCourse(c)
      if (user.role !== "admin" || c.instructorId === user.id) setLessons(await listLessons(id))
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

  const patchLesson = (lessonId: string, fn: (l: Lesson) => Lesson) =>
    setLessons((ls) => ls.map((l) => (l.id === lessonId ? fn(l) : l)))

  return (
    <>
      <PageTitle
        title={course?.title ?? "Course"}
        subtitle={
          isOwner
            ? "Manage lessons, share PDF notes and publish quizzes."
            : course?.shortDescription || "Lessons, notes and quizzes for this course."
        }
        actions={
          isOwner && (
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Course status" className="h-9 w-36" value={course.status} onChange={(e) => onStatus(e.target.value as CourseStatus)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
              <Button variant="outline" onClick={() => setMode(mode === "edit" ? null : "edit")}>
                <Pencil /> Edit
              </Button>
              <Button variant="destructive" onClick={onDelete}>
                <Trash2 /> Delete
              </Button>
              <Button onClick={() => setMode(mode === "lesson" ? null : "lesson")}>
                <Plus /> Add lesson
              </Button>
            </div>
          )
        }
      />

      <ErrorNote error={error} />

      {course && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={course.status === "published" ? "default" : "secondary"} className="capitalize">
            {course.status}
          </Badge>
          {course.isFree && <Badge variant="outline">Free</Badge>}
          {user.role === "admin" && !isOwner && <Badge variant="secondary">Owned by another instructor</Badge>}
        </div>
      )}
      {course?.description && <p className="text-sm whitespace-pre-wrap text-gray-700">{course.description}</p>}

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
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      )}
      {course && !canSeeLessons && (
        <Card className="bg-white">
          <CardContent className="py-8 text-center text-sm text-gray-500">
            Lessons, notes and quizzes are managed by the course&apos;s instructor.
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

      {canSeeLessons &&
        lessons.map((l, i) => (
          <LessonCard
            key={l.id}
            index={i + 1}
            lesson={l}
            isOwner={isOwner}
            onChange={(fn) => patchLesson(l.id, fn)}
            onDeleted={() => setLessons((ls) => ls.filter((x) => x.id !== l.id))}
          />
        ))}
    </>
  )
}

function EditCourse({ course, onSaved }: { course: CourseT; onSaved: (c: CourseT) => void }) {
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
    <Card className="bg-white shadow-xs">
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
            <Input id="ce-title" required maxLength={200} value={form.title} className="h-10 bg-white" onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ce-slug">Slug</FieldLabel>
            <Input id="ce-slug" required maxLength={200} pattern={slugOk} title="Lowercase letters, numbers and single dashes" value={form.slug} className="h-10 bg-white" onChange={(e) => set("slug", e.target.value)} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ce-short">Short description</FieldLabel>
            <Input id="ce-short" maxLength={500} value={form.shortDescription} className="h-10 bg-white" onChange={(e) => set("shortDescription", e.target.value)} />
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function NewLesson({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
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
    <Card className="bg-white shadow-xs">
      <CardHeader>
        <CardTitle>New lesson</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="ltitle">Title</FieldLabel>
            <Input id="ltitle" required maxLength={200} value={title} className="h-10 bg-white" onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lcontent">Short description</FieldLabel>
            <Textarea id="lcontent" maxLength={50000} value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
          <div className="flex gap-6 text-sm text-gray-700">
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
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Create lesson
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function LessonCard({
  index,
  lesson,
  isOwner,
  onChange,
  onDeleted,
}: {
  index: number
  lesson: Lesson
  isOwner: boolean
  onChange: (fn: (l: Lesson) => Lesson) => void
  onDeleted: () => void
}) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<"note" | "quiz" | "edit" | null>(null)
  const notes = lesson.notes ?? []
  const setNotes = (fn: (n: Note[]) => Note[]) => onChange((l) => ({ ...l, notes: fn(l.notes ?? []) }))

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

  async function open(n: Note) {
    setError(null)
    try {
      const url = URL.createObjectURL(await downloadNote(n.id))
      window.open(url, "_blank", "noopener")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(errMsg(e))
    }
  }

  async function remove(n: Note) {
    if (!confirm(`Delete "${n.title}"? The PDF will be removed.`)) return
    setError(null)
    try {
      await deleteNote(n.id)
      setNotes((ns) => ns.filter((x) => x.id !== n.id))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <Card className="bg-white shadow-xs">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            {index}. {lesson.title}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && !lesson.isPublished && <Badge variant="secondary">Draft</Badge>}
            {lesson.isFree && <Badge variant="outline">Free</Badge>}
            {isOwner && (
              <>
                <Button variant="outline" size="sm" onClick={togglePublished}>
                  {lesson.isPublished ? <EyeOff /> : <Eye />}
                  {lesson.isPublished ? "Unpublish" : "Publish"}
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${lesson.title}`} onClick={() => setPanel(panel === "edit" ? null : "edit")}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${lesson.title}`} onClick={removeLesson}>
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        </div>
        {lesson.content && <p className="text-sm whitespace-pre-wrap text-gray-600">{lesson.content}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <ErrorNote error={error} />

        {isOwner && panel === "edit" && (
          <EditLesson
            lesson={lesson}
            onSaved={(l) => {
              onChange((x) => ({ ...x, title: l.title, content: l.content, isFree: l.isFree, isPublished: l.isPublished }))
              setPanel(null)
            }}
          />
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">Notes</h3>
          {notes.length === 0 && <p className="text-sm text-gray-500">No notes shared yet.</p>}
          <ul className="divide-y divide-gray-100">
            {notes.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 py-2">
                <button type="button" onClick={() => open(n)} className="flex min-w-0 items-center gap-2 text-left text-sm hover:underline">
                  <FileText className="size-4 shrink-0 text-indigo-600" />
                  <span className="truncate font-medium text-gray-900">{n.title}</span>
                  <span className="shrink-0 text-xs text-gray-500">{(n.sizeBytes / 1024).toFixed(0)} KB</span>
                </button>
                {isOwner && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${n.title}`} onClick={() => remove(n)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setPanel(panel === "note" ? null : "note")}>
              <Upload /> Share a note
            </Button>
          )}
          {isOwner && panel === "note" && (
            <NoteUpload
              lessonId={lesson.id}
              onUploaded={(n) => {
                setNotes((ns) => [n, ...ns])
                setPanel(null)
              }}
            />
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">Quizzes</h3>
          {quizzes.length === 0 && <p className="text-sm text-gray-500">No quizzes yet.</p>}
          <ul className="space-y-1">
            {quizzes.map((q) => (
              <li key={q.id}>
                <Link href={`/quizzes/${q.id}`} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <ClipboardList className="size-4 text-indigo-600" />
                    {q.title}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-gray-500">
                    {q.questionCount} questions
                    {q.status === "draft" && <Badge variant="secondary">Draft</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setPanel(panel === "quiz" ? null : "quiz")}>
              <Plus /> Create quiz
            </Button>
          )}
          {isOwner && panel === "quiz" && (
            <QuizBuilder
              lessonId={lesson.id}
              onSaved={(q) => {
                setQuizzes((qs) => [...qs, q])
                setPanel(null)
              }}
            />
          )}
        </section>
      </CardContent>
    </Card>
  )
}

function EditLesson({ lesson, onSaved }: { lesson: Lesson; onSaved: (l: Lesson) => void }) {
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
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Field>
        <FieldLabel htmlFor={`el-${lesson.id}`}>Title</FieldLabel>
        <Input id={`el-${lesson.id}`} required maxLength={200} value={title} className="h-10 bg-white" onChange={(e) => setTitle(e.target.value)} />
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
      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Save lesson
      </Button>
    </form>
  )
}

function NoteUpload({ lessonId, onUploaded }: { lessonId: string; onUploaded: (n: Note) => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) return setError("Choose a PDF file.")
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) return setError("Only PDF files are allowed.")
    if (file.size > MAX_PDF) return setError("The PDF must be 25 MB or smaller.")
    setSaving(true)
    try {
      onUploaded(await uploadNote(lessonId, { title: title.trim(), description: description.trim(), file }))
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Field>
        <FieldLabel htmlFor={`nt-${lessonId}`}>Title</FieldLabel>
        <Input id={`nt-${lessonId}`} required maxLength={200} value={title} className="h-10 bg-white" onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`nd-${lessonId}`}>Description (optional)</FieldLabel>
        <Input id={`nd-${lessonId}`} maxLength={2000} value={description} className="h-10 bg-white" onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`nf-${lessonId}`}>PDF (max 25 MB)</FieldLabel>
        <Input id={`nf-${lessonId}`} type="file" accept="application/pdf,.pdf" required className="h-10 bg-white" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <ErrorNote error={error} />
      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Upload
      </Button>
    </form>
  )
}
