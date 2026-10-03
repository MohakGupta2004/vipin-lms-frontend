"use client"

import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  UUID_RE,
  createEnrollment,
  listCourses,
  listEnrollments,
  updateEnrollmentStatus,
  type Course,
  type Enrollment,
  type EnrollmentStatus,
} from "@/lib/api"

const STATUSES: EnrollmentStatus[] = ["active", "completed", "expired", "cancelled"]

export default function EnrollmentsPage() {
  return (
    <AppShell roles={["admin"]}>
      <Suspense>
        <Enrollments />
      </Suspense>
    </AppShell>
  )
}

function Enrollments() {
  const initialCourse = useSearchParams().get("courseId") ?? ""
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState(UUID_RE.test(initialCourse) ? initialCourse : "")
  const [rows, setRows] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCourses(100, 0).then(setCourses).catch((e) => setError(errMsg(e)))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listEnrollments({ courseId: courseId || undefined }, 100))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const title = (id: string) => courses.find((c) => c.id === id)?.title ?? id

  async function onStatus(e: Enrollment, status: EnrollmentStatus) {
    setError(null)
    try {
      const updated = await updateEnrollmentStatus(e.id, status)
      setRows((r) => r.map((x) => (x.id === e.id ? updated : x)))
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <>
      <PageTitle title="Enrollments" subtitle="Enroll students into published courses and manage their access." />

      <EnrollForm courses={courses.filter((c) => c.status === "published")} defaultCourse={courseId} onDone={load} />

      <Card className="bg-white shadow-xs">
        <CardHeader>
          <CardTitle>All enrollments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field className="max-w-sm">
            <FieldLabel htmlFor="filter">Filter by course</FieldLabel>
            <Select id="filter" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <ErrorNote error={error} />
          {loading && (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          )}
          {!loading && rows.length === 0 && <p className="text-sm text-gray-500">No enrollments found.</p>}
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="space-y-0.5 text-sm">
                  <div className="font-medium text-gray-900">{title(r.courseId)}</div>
                  <div className="font-mono text-xs text-gray-500">Student {r.userId}</div>
                  <div className="text-xs text-gray-500">
                    Enrolled {new Date(r.enrolledAt).toLocaleDateString()} ·{" "}
                    {r.expiresAt ? `expires ${new Date(r.expiresAt).toLocaleDateString()}` : "never expires"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {r.source}
                  </Badge>
                  <Select
                    aria-label="Enrollment status"
                    className="h-8 w-32"
                    value={r.status}
                    onChange={(e) => onStatus(r, e.target.value as EnrollmentStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

function EnrollForm({
  courses,
  defaultCourse,
  onDone,
}: {
  courses: Course[]
  defaultCourse: string
  onDone: () => void
}) {
  const [userId, setUserId] = useState("")
  const [course, setCourse] = useState("")
  const [months, setMonths] = useState(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const selected = course || (courses.some((c) => c.id === defaultCourse) ? defaultCourse : "")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)
    if (!UUID_RE.test(userId.trim())) return setError("Student ID must be a valid ID.")
    if (!selected) return setError("Choose a published course.")
    setSaving(true)
    try {
      await createEnrollment({ userId: userId.trim(), courseId: selected, months })
      setOk(true)
      setUserId("")
      onDone()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-white shadow-xs">
      <CardHeader>
        <CardTitle>Enroll a student</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="student">Student ID</FieldLabel>
            <Input
              id="student"
              required
              value={userId}
              className="h-10 bg-white font-mono"
              onChange={(e) => setUserId(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ecourse">Course (published only)</FieldLabel>
            <Select id="ecourse" required value={selected} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="months">Duration (months)</FieldLabel>
            <Input
              id="months"
              type="number"
              min={1}
              max={60}
              required
              value={months}
              className="h-10 bg-white"
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </Field>
          <div className="space-y-3 sm:col-span-2">
            <ErrorNote error={error} />
            {ok && <p className="text-sm text-green-700">Student enrolled.</p>}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Enroll
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
