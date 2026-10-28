"use client"

import { CircleNotchIcon, SparkleIcon } from "@phosphor-icons/react/dist/ssr"
import { useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  ENROLLMENT_TIERS,
  TIER_LABEL,
  UUID_RE,
  createEnrollment,
  courseTitle,
  latestBatches,
  listCourses,
  listEnrollments,
  listNewStudents,
  listUsers,
  updateEnrollment,
  type Course,
  type Enrollment,
  type EnrollmentStatus,
  type EnrollmentTier,
  type UserSummary,
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
  const [students, setStudents] = useState<UserSummary[]>([])
  const [newStudents, setNewStudents] = useState<UserSummary[] | null>(null)
  const [enrollUserId, setEnrollUserId] = useState("")
  const formRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCourses(100, 0).then(setCourses).catch((e) => setError(errMsg(e)))
    listUsers("student").then(setStudents).catch((e) => setError(errMsg(e)))
  }, [])

  const loadNewStudents = useCallback(() => {
    listNewStudents().then(setNewStudents).catch((e) => setError(errMsg(e)))
  }, [])

  useEffect(() => {
    loadNewStudents()
  }, [loadNewStudents])

  // The picker lists students by name and stops at 200, so a brand-new sign-up may be missing from it.
  const pickable = [...students, ...(newStudents ?? []).filter((n) => !students.some((u) => u.id === n.id))]

  function pickForEnroll(u: UserSummary) {
    setEnrollUserId(u.id)
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

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

  const title = (id: string) => {
    const c = courses.find((x) => x.id === id)
    return c ? courseTitle(c) : id
  }
  const student = (id: string) => {
    const u = pickable.find((x) => x.id === id)
    return u ? `${u.firstName} ${u.lastName} (${u.email})` : id
  }

  async function onChange(e: Enrollment, change: { status?: EnrollmentStatus; tier?: EnrollmentTier }) {
    setError(null)
    try {
      const updated = await updateEnrollment(e.id, change)
      setRows((r) => r.map((x) => (x.id === e.id ? updated : x)))
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <>
      <PageTitle title="Enrollments" subtitle="Enroll students into published courses and manage their access." />

      <NewStudents students={newStudents} onEnroll={pickForEnroll} />

      <div ref={formRef} className="scroll-mt-6">
        <EnrollForm
          students={pickable}
          // New students go into the newest published batch of a course, so older batches are left out.
          courses={latestBatches(courses.filter((c) => c.status === "published"))}
          defaultCourse={courseId}
          userId={enrollUserId}
          onUserId={setEnrollUserId}
          onDone={() => {
            load()
            loadNewStudents()
          }}
        />
      </div>

      <Card className="bg-white">
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
                  {courseTitle(c)}
                </option>
              ))}
            </Select>
          </Field>
          <ErrorNote error={error} />
          {loading && (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <CircleNotchIcon className="size-4 animate-spin" /> Loading…
            </p>
          )}
          {!loading && rows.length === 0 && <p className="text-sm text-gray-500">No enrollments found.</p>}
          <ul className="divide-y divide-border">
            {rows.map((r, i) => (
              <li key={r.id} className="rise -mx-3 flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-4 transition-colors hover:bg-mint/60" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                <div className="space-y-0.5 text-sm">
                  <div className="font-semibold text-heading">{title(r.courseId)}</div>
                  <div className="text-xs text-gray-600">Student: {student(r.userId)}</div>
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
                    aria-label="Enrollment tier"
                    className="h-8 w-28"
                    value={r.tier}
                    onChange={(e) => onChange(r, { tier: e.target.value as EnrollmentTier })}
                  >
                    {ENROLLMENT_TIERS.map((t) => (
                      <option key={t} value={t}>
                        {TIER_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Enrollment status"
                    className="h-8 w-32"
                    value={r.status}
                    onChange={(e) => onChange(r, { status: e.target.value as EnrollmentStatus })}
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

/** "Today", "Yesterday", "5 days ago", then the date. */
function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (d < 1) return "today"
  if (d === 1) return "yesterday"
  if (d < 7) return `${d} days ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/** Students who signed up but were never enrolled, newest first, so the admin can give them access. */
function NewStudents({ students, onEnroll }: { students: UserSummary[] | null; onEnroll: (u: UserSummary) => void }) {
  if (!students || students.length === 0) return null
  return (
    <Card className="border-primary/40 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparkleIcon className="size-5 text-primary" weight="fill" />
          New students
          <Badge>{students.length}</Badge>
        </CardTitle>
        <p className="text-sm text-gray-500">Signed up but not enrolled in any course yet.</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {students.map((u, i) => (
            <li
              key={u.id}
              className="rise -mx-3 flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors hover:bg-mint/60"
              style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
            >
              <div className="space-y-0.5 text-sm">
                <div className="font-semibold text-heading">
                  {u.firstName} {u.lastName}
                </div>
                <div className="text-xs text-gray-600">{u.email}</div>
                <div className="text-xs text-gray-500">
                  Signed up {daysAgo(u.createdAt)}
                  {u.lastLoginAt && ` · last login ${daysAgo(u.lastLoginAt)}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.emailVerified ? "secondary" : "outline"}>
                  {u.emailVerified ? "Email verified" : "Not verified"}
                </Badge>
                <Button size="sm" onClick={() => onEnroll(u)}>
                  Enroll
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function EnrollForm({
  students,
  courses,
  defaultCourse,
  userId,
  onUserId: setUserId,
  onDone,
}: {
  students: UserSummary[]
  courses: Course[]
  defaultCourse: string
  userId: string
  onUserId: (id: string) => void
  onDone: () => void
}) {
  const [course, setCourse] = useState("")
  const [months, setMonths] = useState(3)
  const [tier, setTier] = useState<EnrollmentTier | "">("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const selected = course || (courses.some((c) => c.id === defaultCourse) ? defaultCourse : "")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)
    if (!userId) return setError("Choose a student.")
    if (!selected) return setError("Choose a published course.")
    if (!tier) return setError("Choose a tier.")
    setSaving(true)
    try {
      await createEnrollment({ userId, courseId: selected, months, tier })
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
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Enroll a student</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="student">Student</FieldLabel>
            <Select id="student" required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">{students.length ? "Select a student…" : "No students found"}</option>
              {students.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ecourse">Course (published only)</FieldLabel>
            <Select id="ecourse" required value={selected} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseTitle(c)}
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
             
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="etier">Tier</FieldLabel>
            <Select id="etier" required value={tier} onChange={(e) => setTier(e.target.value as EnrollmentTier | "")}>
              <option value="">Select a tier…</option>
              {ENROLLMENT_TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="space-y-3 sm:col-span-2">
            <ErrorNote error={error} />
            {ok && <p className="text-sm text-green-700">Student enrolled.</p>}
            <Button type="submit" disabled={saving}>
              {saving && <CircleNotchIcon className="animate-spin" />}
              Enroll
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
