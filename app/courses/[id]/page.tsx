"use client"

import { ClipboardList, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
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
  deleteNote,
  downloadNote,
  listLessons,
  listQuizzes,
  loadKnownCourses,
  updateCourseStatus,
  uploadNote,
  type CourseStatus,
  type Lesson,
  type Note,
  type Quiz,
} from "@/lib/api"

const MAX_PDF = 25 * 1024 * 1024

export default function CoursePage() {
  return (
    <AppShell roles={["instructor", "student"]}>
      <Course />
    </AppShell>
  )
}

function Course() {
  const user = useUser()!
  const isInstructor = user.role === "instructor"
  const { id } = useParams<{ id: string }>()
  const valid = UUID_RE.test(id)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(valid)
  const [error, setError] = useState<string | null>(valid ? null : "That is not a valid course ID.")
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState<CourseStatus | "">("")
  const [title, setTitle] = useState("")

  const load = useCallback(async () => {
    setError(null)
    try {
      setLessons(await listLessons(id))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!valid) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    setTitle(loadKnownCourses().find((c) => c.id === id)?.title ?? "")
  }, [valid, id, load])

  async function onStatus(next: CourseStatus) {
    setError(null)
    try {
      setStatus((await updateCourseStatus(id, next)).status)
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const patchLesson = (lessonId: string, fn: (l: Lesson) => Lesson) =>
    setLessons((ls) => ls.map((l) => (l.id === lessonId ? fn(l) : l)))

  return (
    <>
      <PageTitle
        title={title || "Course"}
        subtitle={isInstructor ? "Add lessons, share PDF notes and publish quizzes." : "Lessons, notes and quizzes for this course."}
        actions={
          isInstructor && (
            <div className="flex items-center gap-2">
              <Select
                aria-label="Course status"
                className="h-9 w-40"
                value={status}
                onChange={(e) => onStatus(e.target.value as CourseStatus)}
              >
                <option value="" disabled>
                  Set status…
                </option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
              <Button onClick={() => setAdding((v) => !v)}>
                <Plus />
                {adding ? "Close" : "Add lesson"}
              </Button>
            </div>
          )
        }
      />

      <ErrorNote error={error} />

      {isInstructor && adding && (
        <NewLesson
          courseId={id}
          onCreated={() => {
            setAdding(false)
            load()
          }}
        />
      )}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Loading lessons…
        </p>
      )}
      {!loading && !error && lessons.length === 0 && (
        <Card className="bg-white">
          <CardContent className="py-10 text-center text-sm text-gray-500">
            {isInstructor ? "No lessons yet. Add the first one." : "No lessons have been published yet."}
          </CardContent>
        </Card>
      )}

      {lessons.map((l, i) => (
        <LessonCard
          key={l.id}
          index={i + 1}
          lesson={l}
          isInstructor={isInstructor}
          userId={user.id}
          onNotes={(fn) => patchLesson(l.id, (x) => ({ ...x, notes: fn(x.notes ?? []) }))}
        />
      ))}
    </>
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
  isInstructor,
  userId,
  onNotes,
}: {
  index: number
  lesson: Lesson
  isInstructor: boolean
  userId: string
  onNotes: (fn: (n: Note[]) => Note[]) => void
}) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<"note" | "quiz" | null>(null)
  const notes = lesson.notes ?? []

  useEffect(() => {
    listQuizzes(lesson.id).then(setQuizzes).catch((e) => setError(errMsg(e)))
  }, [lesson.id])

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
      onNotes((ns) => ns.filter((x) => x.id !== n.id))
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
          <div className="flex gap-2">
            {isInstructor && !lesson.isPublished && <Badge variant="secondary">Draft</Badge>}
            {lesson.isFree && <Badge variant="outline">Free</Badge>}
          </div>
        </div>
        {lesson.content && <p className="text-sm whitespace-pre-wrap text-gray-600">{lesson.content}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <ErrorNote error={error} />

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
                {isInstructor && n.uploadedBy === userId && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${n.title}`} onClick={() => remove(n)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {isInstructor && (
            <Button variant="outline" size="sm" onClick={() => setPanel(panel === "note" ? null : "note")}>
              <Upload /> Share a note
            </Button>
          )}
          {isInstructor && panel === "note" && (
            <NoteUpload
              lessonId={lesson.id}
              onUploaded={(n) => {
                onNotes((ns) => [n, ...ns])
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
          {isInstructor && (
            <Button variant="outline" size="sm" onClick={() => setPanel(panel === "quiz" ? null : "quiz")}>
              <Plus /> Create quiz
            </Button>
          )}
          {isInstructor && panel === "quiz" && (
            <QuizBuilder
              lessonId={lesson.id}
              onCreated={(q) => {
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
