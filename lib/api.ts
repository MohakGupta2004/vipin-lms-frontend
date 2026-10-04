// Typed client for the Vipin LMS API (see http://localhost:3000/swagger/index.html).
// Auth is cookie based (HttpOnly access_token + refresh_token), so no token is ever readable from JS.

export type Role = "student" | "instructor" | "admin"

export type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Role
  lastLoginAt: string
}

export type CourseStatus = "draft" | "published" | "archived"
export type EnrollmentStatus = "active" | "completed" | "expired" | "cancelled"
export type QuizStatus = "draft" | "published"

export type UserSummary = Pick<User, "id" | "firstName" | "lastName" | "email" | "role">

export type Exam = { id: string; code: string; name: string; description: string }

export type Course = {
  id: string
  examId: string
  instructorId: string
  title: string
  slug: string
  shortDescription: string
  description: string
  status: CourseStatus
  isFree: boolean
  createdAt: string
}

export type Enrollment = {
  id: string
  userId: string
  courseId: string
  status: EnrollmentStatus
  source: string
  enrolledAt: string
  expiresAt: string | null
}

export type Note = {
  id: string
  courseId: string
  lessonId: string
  title: string
  description: string
  fileName: string
  sizeBytes: number
  uploadedBy: string
  uploaderName: string
  createdAt: string
}

export type Lesson = {
  id: string
  courseId: string
  title: string
  content: string
  lessonType: string
  position: number
  isFree: boolean
  isPublished: boolean
  createdAt: string
  notes: Note[] | null
}

export type Post = {
  id: string
  authorId: string
  authorName: string
  courseId: string
  courseTitle: string
  content: string
  links: string[] | null
  createdAt: string
}

export type QuestionOption = {
  id: string
  optionText: string
  position: number
  // Only present for the instructor; hidden from students until they submit.
  isCorrect?: boolean | null
}

export type Question = {
  id: string
  questionText: string
  explanation?: string
  position: number
  options: QuestionOption[]
}

export type Quiz = {
  id: string
  courseId: string
  lessonId: string
  createdBy: string
  title: string
  description: string
  status: QuizStatus
  isFree: boolean
  passPercent: number
  timeLimitSec: number | null
  questionCount: number
  questions?: Question[] | null
  createdAt: string
}

export type AttemptAnswer = {
  questionId: string
  selectedOptionId: string | null
  correctOptionId: string
  isCorrect: boolean
  explanation?: string
}

export type QuizAttempt = {
  id: string
  quizId: string
  userId: string
  score: number
  total: number
  passed: boolean
  startedAt: string
  submittedAt: string
  answers: AttemptAnswer[] | null
}

export type NewQuestion = {
  questionText: string
  explanation?: string
  options: { optionText: string; isCorrect: boolean }[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1`

type Query = Record<string, string | number | undefined>
type Options = { body?: unknown; form?: FormData; query?: Query }

const id = encodeURIComponent

function url(path: string, query?: Query) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") qs.set(k, String(v))
  }
  const s = qs.toString()
  return `${API_BASE}${path}${s ? `?${s}` : ""}`
}

async function send(method: string, path: string, { body, form, query }: Options) {
  const headers: Record<string, string> = { Accept: "application/json" }
  let payload: BodyInit | undefined
  if (form) {
    payload = form // the browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    payload = JSON.stringify(body)
  }
  try {
    return await fetch(url(path, query), {
      method,
      credentials: "include",
      headers,
      body: payload,
    })
  } catch {
    throw new ApiError("Unable to reach the server. Please try again.", 0)
  }
}

const NO_RENEW = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"])

let lastRefreshedAt = 0
let refreshing: Promise<boolean> | null = null

/**
 * Renews the access_token using the refresh_token cookie.
 * Deduplicates in-flight refresh requests and prevents rapid redundant refreshes.
 */
export function refreshOnce(): Promise<boolean> {
  if (Date.now() - lastRefreshedAt < 5_000) {
    return Promise.resolve(true)
  }
  if (refreshing) return refreshing

  refreshing = send("POST", "/auth/refresh", {})
    .then((r) => {
      if (r.ok) {
        lastRefreshedAt = Date.now()
        markSessionVerified()
        return true
      }
      return false
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })

  return refreshing
}

// Sends the request; on 401 renews the access token once and retries.
// If that fails the session is gone, so the local user is cleared and the UI returns to /login.
async function call(method: string, path: string, opts: Options = {}) {
  let res = await send(method, path, opts)
  // Login/register/refresh/logout handle their own 401s; everything else (incl. /auth/me) may renew the session.
  if (res.status === 401 && !NO_RENEW.has(path)) {
    const refreshed = await refreshOnce()
    if (refreshed) {
      res = await send(method, path, opts)
    }
    if (res.status === 401) {
      clearUser()
    }
  }
  return res
}

async function fail(res: Response): Promise<never> {
  // Backend returns JSON {status,message}, but plain text for some malformed payloads.
  const text = await res.text()
  let message: string | undefined
  try {
    message = JSON.parse(text).message
  } catch {}
  throw new ApiError(message || text.trim() || "Something went wrong", res.status)
}

async function json<T>(method: string, path: string, opts?: Options): Promise<T> {
  const res = await call(method, path, opts)
  if (!res.ok) return fail(res)
  const parsed = (await res.json().catch(() => null)) as { data?: T } | null
  return parsed?.data as T
}

// ── auth ────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  json<User>("POST", "/auth/login", { body: { email, password } })

export const register = (input: {
  firstName: string
  lastName: string
  email: string
  password: string
}) => json<User>("POST", "/auth/register", { body: input })

export const refreshSession = () => refreshOnce()

/** The server's view of the signed-in user (current role included). */
export const getMe = () => json<User>("GET", "/auth/me")

/** Clears the HttpOnly auth cookies on the server, then the local copy. */
export async function logout() {
  try {
    await json<string>("POST", "/auth/logout")
  } finally {
    clearUser()
  }
}

// ── users (admin) ───────────────────────────────────────────────────────────
export const listUsers = async (role?: Role, limit = 200, offset = 0) =>
  (await json<UserSummary[]>("GET", "/users", { query: { role, limit, offset } })) ?? []

// ── exams ───────────────────────────────────────────────────────────────────
export const listExams = async () => (await json<Exam[]>("GET", "/exams")) ?? []

// ── courses ─────────────────────────────────────────────────────────────────
export const listCourses = async (limit = 50, offset = 0) =>
  (await json<Course[]>("GET", "/courses", { query: { limit, offset } })) ?? []

export const listMyCourses = async (limit = 100, offset = 0) =>
  (await json<Course[]>("GET", "/me/courses", { query: { limit, offset } })) ?? []

export const getCourse = (courseId: string) => json<Course>("GET", `/courses/${id(courseId)}`)

export const createCourse = (input: {
  examId: string
  /** Optional: the server defaults to the logged-in admin. */
  instructorId?: string
  title: string
  slug: string
  shortDescription?: string
  description?: string
  status?: CourseStatus
  isFree?: boolean
}) => json<Course>("POST", "/courses", { body: input })

export const updateCourse = (
  courseId: string,
  input: Partial<{
    title: string
    slug: string
    shortDescription: string
    description: string
    examId: string
    isFree: boolean
  }>
) => json<Course>("PATCH", `/courses/${id(courseId)}`, { body: input })

export const deleteCourse = (courseId: string) =>
  json<string>("DELETE", `/courses/${id(courseId)}`)

export const updateCourseStatus = (courseId: string, status: CourseStatus) =>
  json<Course>("PATCH", `/courses/${id(courseId)}/status`, { body: { status } })

// ── lessons & notes ─────────────────────────────────────────────────────────
export const listLessons = async (courseId: string) =>
  (await json<Lesson[]>("GET", `/courses/${id(courseId)}/lessons`)) ?? []

export const createLesson = (
  courseId: string,
  input: { title: string; content?: string; isFree?: boolean; isPublished?: boolean }
) => json<Lesson>("POST", `/courses/${id(courseId)}/lessons`, { body: input })

export const updateLesson = (
  lessonId: string,
  input: Partial<{ title: string; content: string; isFree: boolean; isPublished: boolean }>
) => json<Lesson>("PATCH", `/lessons/${id(lessonId)}`, { body: input })

export const deleteLesson = (lessonId: string) =>
  json<string>("DELETE", `/lessons/${id(lessonId)}`)

export const uploadNote = (
  lessonId: string,
  input: { title: string; description?: string; file: File }
) => {
  const form = new FormData()
  form.set("title", input.title)
  if (input.description) form.set("description", input.description)
  form.set("file", input.file)
  return json<Note>("POST", `/lessons/${id(lessonId)}/notes`, { form })
}

export const deleteNote = (noteId: string) =>
  json<string>("DELETE", `/notes/${id(noteId)}`)

/** Fetches the PDF as a Blob (the cookie-authenticated endpoint cannot be used as a plain link). */
export async function downloadNote(noteId: string): Promise<Blob> {
  const res = await call("GET", `/notes/${id(noteId)}/file`)
  if (!res.ok) return fail(res)
  return new Blob([await res.arrayBuffer()], { type: "application/pdf" })
}

// ── enrollments ─────────────────────────────────────────────────────────────
export const listEnrollments = async (
  filter: { courseId?: string; userId?: string } = {},
  limit = 50,
  offset = 0
) =>
  (await json<Enrollment[]>("GET", "/enrollments", { query: { ...filter, limit, offset } })) ?? []

export const createEnrollment = (input: { userId: string; courseId: string; months: number }) =>
  json<Enrollment>("POST", "/enrollments", { body: input })

export const updateEnrollmentStatus = (enrollmentId: string, status: EnrollmentStatus) =>
  json<Enrollment>("PATCH", `/enrollments/${id(enrollmentId)}`, { body: { status } })

// ── posts ───────────────────────────────────────────────────────────────────
export const listPosts = async (limit = 50, offset = 0) =>
  (await json<Post[]>("GET", "/posts", { query: { limit, offset } })) ?? []

export const createPost = (input: { courseId: string; content: string; links?: string[] }) =>
  json<Post>("POST", "/posts", { body: input })

export const deletePost = (postId: string) => json<string>("DELETE", `/posts/${id(postId)}`)

// ── quizzes ─────────────────────────────────────────────────────────────────
export const listQuizzes = async (lessonId: string) =>
  (await json<Quiz[]>("GET", `/lessons/${id(lessonId)}/quizzes`)) ?? []

export const createQuiz = (
  lessonId: string,
  input: {
    title: string
    description?: string
    isFree?: boolean
    passPercent?: number
    timeLimitSec?: number
    status?: QuizStatus
    questions: NewQuestion[]
  }
) => json<Quiz>("POST", `/lessons/${id(lessonId)}/quizzes`, { body: input })

export const updateQuiz = (
  quizId: string,
  input: Partial<{
    title: string
    description: string
    isFree: boolean
    passPercent: number
    /** 0 makes the quiz untimed. */
    timeLimitSec: number
    status: QuizStatus
    questions: NewQuestion[]
  }>
) => json<Quiz>("PATCH", `/quizzes/${id(quizId)}`, { body: input })

export const deleteQuiz = (quizId: string) => json<string>("DELETE", `/quizzes/${id(quizId)}`)

export const getQuiz = (quizId: string) => json<Quiz>("GET", `/quizzes/${id(quizId)}`)

export const updateQuizStatus = (quizId: string, status: QuizStatus) =>
  json<Quiz>("PATCH", `/quizzes/${id(quizId)}/status`, { body: { status } })

export const submitAttempt = (
  quizId: string,
  answers: { questionId: string; optionId: string }[]
) => json<QuizAttempt>("POST", `/quizzes/${id(quizId)}/attempts`, { body: { answers } })

export const listAttempts = async (quizId: string) =>
  (await json<QuizAttempt[]>("GET", `/quizzes/${id(quizId)}/attempts`)) ?? []

// ── local session cache (profile only; tokens live in HttpOnly cookies) ─────
export const USER_KEY = "lms_user"

let lastVerified = 0
export const VERIFY_EVERY_MS = 60_000

export function markSessionVerified() {
  lastVerified = Date.now()
}

export function isSessionFresh() {
  return Date.now() - lastVerified < VERIFY_EVERY_MS
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function subscribeSession(cb: () => void) {
  listeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

export function readSession(): string | null {
  try {
    return localStorage.getItem(USER_KEY)
  } catch {
    return null
  }
}

export function parseUser(raw: string | null): User | null {
  if (!raw) return null
  try {
    const u = JSON.parse(raw) as User
    return u && typeof u.id === "string" && typeof u.role === "string" ? u : null
  } catch {
    return null
  }
}

export function saveUser(user: User) {
  markSessionVerified()
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {}
  notify()
}

export function clearUser() {
  lastVerified = 0
  try {
    localStorage.removeItem(USER_KEY)
  } catch {}
  notify()
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

