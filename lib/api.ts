// Typed client for the Vipin LMS API (see http://localhost:3000/swagger/index.html).
// Auth is cookie based (HttpOnly access_token + refresh_token), so no token is ever readable from JS.

export type Role = "student" | "instructor" | "admin"

export type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  // Empty for accounts created before phone numbers were collected.
  phone: string
  role: Role
  lastLoginAt: string
}

export type CourseStatus = "draft" | "published" | "archived"
export type CourseVisibility = "public" | "private"
export type EnrollmentStatus = "active" | "completed" | "expired" | "cancelled"
export type QuizStatus = "draft" | "published"
export type QuizType = "mock_test" | "practice"

export const QUIZ_TYPE_LABEL: Record<QuizType, string> = { mock_test: "Mock test", practice: "Practice test" }
/** Section headings: tests are always shown to people as mock tests or practice tests, never "quizzes". */
export const QUIZ_TYPE_PLURAL: Record<QuizType, string> = { mock_test: "Mock tests", practice: "Practice tests" }

/**
 * How much of a course a user can open. Not enrolled = free; an enrollment is plus, premium or ultra.
 * The owner, and everyone in a free course, are ultra.
 */
export type Tier = "free" | "plus" | "premium" | "ultra"
/** What an item is tagged with. Ultra is never stored: it always opens everything. */
export type ContentTier = Exclude<Tier, "ultra">
export type EnrollmentTier = Exclude<Tier, "free">

export const TIER_ORDER: Tier[] = ["free", "plus", "premium", "ultra"]
export const TIER_LABEL: Record<Tier, string> = { free: "Free", plus: "Plus", premium: "Premium", ultra: "Ultra" }
export const ENROLLMENT_TIERS: EnrollmentTier[] = ["plus", "premium", "ultra"]

export type VideoKind = "offline" | "meet"
export const VIDEO_KIND_LABEL: Record<VideoKind, string> = { offline: "Offline Recordings", meet: "Meet Recordings" }
export const VIDEO_KINDS: VideoKind[] = ["offline", "meet"]

/** The tiers the instructor's picker starts with, and the server's default when none are sent. */
export const DEFAULT_TIERS: Record<"note" | "quiz" | "flashcard" | "offline" | "meet", ContentTier[]> = {
  note: ["plus", "premium"],
  quiz: ["plus", "premium"],
  flashcard: ["plus", "premium"],
  offline: ["premium"],
  meet: [],
}

/** Same rule as the server: ultra opens everything, `free` opens for everyone, else the tier must be listed. */
export const canAccess = (tier: Tier, tags: readonly ContentTier[] | null | undefined) =>
  tier === "ultra" || !!tags?.includes("free") || !!tags?.includes(tier as ContentTier)

/** Who can open an item, for a badge: "Free", "Plus · Premium · Ultra" or "Ultra only". */
export function tierAvailability(tags: readonly ContentTier[] | null | undefined): string {
  if (tags?.includes("free")) return "Free"
  const names = TIER_ORDER.filter((t) => t !== "free" && t !== "ultra" && tags?.includes(t)).map((t) => TIER_LABEL[t])
  return names.length ? [...names, TIER_LABEL.ultra].join(" · ") : `${TIER_LABEL.ultra} only`
}

export type UserSummary = Pick<User, "id" | "firstName" | "lastName" | "email" | "role"> & {
  createdAt: string
  lastLoginAt: string | null
  emailVerified: boolean
}

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
  /** private: only students already enrolled still see it, until their enrollment ends. */
  visibility: CourseVisibility
  /** Shared by every batch of a course: the id of its first batch. */
  batchGroupId: string
  /** 1 for the first batch of a course; 2 is shown as "2.0". */
  batchNumber: number
  createdAt: string
  /**
   * Only from GET /courses/{id}. "full": enrolled, or the course is free. "preview": published course
   * the user isn't enrolled in, so only free lessons, notes, quizzes and videos open.
   */
  access?: CourseAccess
  /** Only from GET /courses/{id}: my tier in this course. */
  tier?: Tier
}

export type CourseAccess = "owner" | "full" | "preview"

/** "2.0" for the second batch of a course, "3.0" for the third; null for the first. */
export const batchLabel = (c: Pick<Course, "batchNumber">) => (c.batchNumber > 1 ? `${c.batchNumber}.0` : null)

/** "IFC 2.0" for a later batch of a course, plain "IFC" for the first one. */
export const courseTitle = (c: Pick<Course, "title" | "batchNumber">) => {
  const batch = batchLabel(c)
  return batch ? `${c.title} ${batch}` : c.title
}

/** Only the newest batch of each course in the list (IFC 2.0, not IFC), in the same order. */
export const latestBatches = <T extends Pick<Course, "batchGroupId" | "batchNumber">>(courses: T[]) =>
  courses.filter((c) => !courses.some((o) => o.batchGroupId === c.batchGroupId && o.batchNumber > c.batchNumber))

/** A published course in the catalog, with what a non-enrolled user can open for free. */
export type CatalogCourse = Course & {
  instructorName: string
  enrolled: boolean
  lessonCount: number
  videoCount: number
  freeLessonCount: number
  freeVideoCount: number
  freeNoteCount: number
  freeQuizCount: number
  freeFlashcardCount: number
}

export type Enrollment = {
  id: string
  userId: string
  courseId: string
  status: EnrollmentStatus
  tier: EnrollmentTier
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
  /** Tiers that can open it (ultra always can). A free note opens without enrolling, even in a paid lesson. */
  tiers: ContentTier[]
  /** Read-only: `free` is in `tiers`. */
  isFree: boolean
  uploadedBy: string
  uploaderName: string
  createdAt: string
  /** Previewing a course you're not enrolled in: the title shows, but it can't be opened. */
  locked?: boolean
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
  /** Previewing a course you're not enrolled in: this lesson's content stays closed. */
  locked?: boolean
}

/** uploading → (PUT + confirm) → processing → ready | failed */
export type VideoStatus = "uploading" | "processing" | "ready" | "failed"

export type Video = {
  id: string
  courseId: string
  lessonId: string
  title: string
  /** What the lecture covers, shown under the player. "" = none written. */
  description: string
  /** Offline Recordings or Meet Recordings: shown as two separate sections. */
  kind: VideoKind
  /** Tiers that can stream it (ultra always can). */
  tiers: ContentTier[]
  /** Read-only: `free` is in `tiers`. */
  isFree: boolean
  sizeBytes: number
  status: VideoStatus
  error: string
  createdAt: string
  updatedAt: string
  /** Previewing a course you're not enrolled in: the title shows, but it can't be streamed. */
  locked?: boolean
  /** The signed-in user's own playback; absent until they play it. */
  progress?: VideoProgress
}

export type VideoProgress = {
  positionSec: number
  /** What the player reported; null until it has. */
  durationSec: number | null
  completedAt: string | null
  updatedAt: string
}

/** A video in one of my courses (GET /me/videos). */
export type MyVideo = Video & { courseTitle: string; lessonTitle: string }

export type VideoStream = {
  /** Signed HLS manifest; every playlist/segment inside is signed too. Expires at `expiresAt`. */
  manifestUrl: string
  queryParams: string
  expiresAt: string
  /** Seconds; where this user stopped last time (0 = from the start). */
  resumeAt: number
}

export type VideoUpload = {
  video: Video
  uploadUrl: string
  method: string
  headers: Record<string, string> | null
  expiresAt: string
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
  type: QuizType
  status: QuizStatus
  /** Tiers that can open it (ultra always can). */
  tiers: ContentTier[]
  /** Read-only: `free` is in `tiers`. */
  isFree: boolean
  /** null for practice sets. */
  passPercent: number | null
  timeLimitSec: number | null
  questionCount: number
  questions?: Question[] | null
  createdAt: string
  /** Previewing a course you're not enrolled in: the title shows, but it can't be opened. */
  locked?: boolean
}

export type DeckStatus = "draft" | "published"
export type FlashcardRating = 1 | 2 | 3 | 4 | 5

/** The flashcards of one lesson, or of the whole course when lessonId is null. */
export type FlashcardDeck = {
  id: string
  courseId: string
  lessonId: string | null
  lessonTitle?: string
  courseTitle: string
  status: DeckStatus
  cardCount: number
  freeCardCount: number
  /** Cards my tier can study. */
  accessibleCardCount: number
  /** There are cards, but none is open to my tier. */
  locked?: boolean
  /** My progress: cards I rated, and cards I rated 4 or 5. */
  myReviewed: number
  myMastered: number
}

export type Flashcard = {
  id: string
  deckId: string
  courseId: string
  front: string
  back: string
  /** Tiers that can study it (ultra always can). */
  tiers: ContentTier[]
  /** Read-only: `free` is in `tiers`. */
  isFree: boolean
  position: number
  myRating: FlashcardRating | null
  /** Previewing a course you're not enrolled in: front and back are blank. */
  locked?: boolean
}

/** GET /me/flashcards: the deck of the lesson I studied last, and all my decks. */
export type MyFlashcards = { recent: FlashcardDeck | null; decks: FlashcardDeck[] }

export const RATING_LABEL: Record<FlashcardRating, string> = {
  1: "No idea",
  2: "Hard",
  3: "Okay",
  4: "Good",
  5: "Perfect",
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
  /** score, total and passed are null for practice attempts. */
  score: number | null
  total: number | null
  passed: boolean | null
  startedAt: string
  submittedAt: string
  /** Practice: the questions answered. Mock test: every question (selectedOptionId null if skipped). */
  answers: AttemptAnswer[] | null
}

/** What a mock test submit returns: the marks, and every question graded for the review. */
export type MockResult = {
  attemptId: string
  quizId: string
  score: number
  total: number
  passed: boolean
  passPercent: number
  submittedAt: string
  /** Every question, with the correct option and explanation; selectedOptionId is null if skipped. */
  answers: AttemptAnswer[]
}

export const isPractice = (q: Pick<Quiz, "type">) => q.type === "practice"

/** A quiz in one of my courses (GET /me/quizzes), with how I did. */
export type MyQuiz = Quiz & {
  courseTitle: string
  lessonTitle: string
  attemptCount: number
  /** Mock tests only: best score in percent. */
  bestPercent: number | null
  /** Mock tests only: true once any attempt passed. */
  passed: boolean | null
  lastAttemptAt: string | null
}

/** What I have done in a course (or, in `totals`, across all of them). */
export type CourseProgress = {
  courseId?: string
  courseTitle?: string
  videosTotal: number
  videosCompleted: number
  videosInProgress: number
  /** Approximate: full length of completed videos plus the position reached in the rest. */
  watchedSec: number
  practiceTotal: number
  practiceDone: number
  mockTotal: number
  mockDone: number
  mockPassed: number
  /** Average of the best score of each mock test taken; null when none taken. */
  mockAvgPercent: number | null
  quizAttempts: number
  notesTotal: number
  /** Videos completed + quizzes attempted, out of all of them. */
  percent: number
}

export type ProgressSummary = {
  courseCount: number
  totals: CourseProgress
  courses: CourseProgress[]
  continueWatching: MyVideo[]
}

/** One student's progress in one course the instructor owns, with their enrollment. */
export type StudentCourse = CourseProgress & {
  courseId: string
  courseTitle: string
  enrollmentStatus: EnrollmentStatus
  tier: EnrollmentTier
  enrolledAt: string
  expiresAt: string | null
  /** Cards in published decks, and how many of them the student rated at least once. */
  flashcardsTotal: number
  flashcardsReviewed: number
  /** Latest video progress, test submission or flashcard rating; null if they never started. */
  lastActiveAt: string | null
}

/** A student enrolled in the instructor's courses: totals across them, and each course. */
export type StudentProgress = {
  id: string
  firstName: string
  lastName: string
  email: string
  totals: CourseProgress
  flashcardsTotal: number
  flashcardsReviewed: number
  lastActiveAt: string | null
  courses: StudentCourse[]
}

/** A video the student has played, most recently watched first. */
export type StudentVideo = {
  videoId: string
  title: string
  courseId: string
  courseTitle: string
  lessonTitle: string
  progress?: VideoProgress
}

/** A submitted test attempt, newest first. */
export type StudentAttempt = {
  id: string
  quizId: string
  quizTitle: string
  quizType: QuizType
  courseId: string
  courseTitle: string
  lessonTitle: string
  score: number
  total: number
  percent: number
  /** null for practice tests, which have no pass mark. */
  passed: boolean | null
  submittedAt: string
}

export type StudentDetail = StudentProgress & { videos: StudentVideo[]; attempts: StudentAttempt[] }

export type NewQuestion = {
  questionText: string
  explanation?: string
  options: { optionText: string; isCorrect: boolean }[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Seconds from the `Retry-After` header on 429 responses. */
    public retryAfter?: number
  ) {
    super(message)
  }
}

const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1`

type Query = Record<string, string | number | undefined>
type Options = { body?: unknown; form?: FormData; query?: Query; keepalive?: boolean }

const id = encodeURIComponent

function url(path: string, query?: Query) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") qs.set(k, String(v))
  }
  const s = qs.toString()
  return `${API_BASE}${path}${s ? `?${s}` : ""}`
}

async function send(method: string, path: string, { body, form, query, keepalive }: Options) {
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
      keepalive,
    })
  } catch {
    throw new ApiError("Unable to reach the server. Please try again.", 0)
  }
}

const NO_RENEW = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/verify-otp",
  "/auth/reset-password",
])

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
  const retry = Number(res.headers.get("Retry-After"))
  throw new ApiError(
    message || text.trim() || "Something went wrong",
    res.status,
    Number.isFinite(retry) && retry > 0 ? retry : undefined
  )
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
  phone: string
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

export type OtpPurpose = "email_verification" | "password_reset"

/** Emails a 6-digit code to the signed-in user (login required). */
export const sendVerifyEmail = () => json<unknown>("POST", "/auth/verify-email")

/** Emails a reset code if the account exists; the reply is identical either way. */
export const forgotPassword = (email: string) =>
  json<unknown>("POST", "/auth/forgot-password", { body: { email } })

/** Checks a code. For `password_reset` the result carries the single-use `resetToken`. */
export const verifyOtp = (email: string, purpose: OtpPurpose, otp: string) =>
  json<{ resetToken?: string }>("POST", "/auth/verify-otp", { body: { email, purpose, otp } })

export const resetPassword = (resetToken: string, newPassword: string) =>
  json<unknown>("POST", "/auth/reset-password", { body: { resetToken, newPassword } })

// ── users (admin) ───────────────────────────────────────────────────────────
export const listUsers = async (role?: Role, limit = 200, offset = 0) =>
  (await json<UserSummary[]>("GET", "/users", { query: { role, limit, offset } })) ?? []

/** Students who signed up but were never enrolled in any course, newest sign-up first. */
export const listNewStudents = async (limit = 50) =>
  (await json<UserSummary[]>("GET", "/users", { query: { role: "student", notEnrolled: "true", limit } })) ?? []

// ── exams ───────────────────────────────────────────────────────────────────
export const listExams = async () => (await json<Exam[]>("GET", "/exams")) ?? []

// ── courses ─────────────────────────────────────────────────────────────────
export const listCourses = async (limit = 50, offset = 0) =>
  (await json<Course[]>("GET", "/courses", { query: { limit, offset } })) ?? []

export const listMyCourses = async (limit = 100, offset = 0) =>
  (await json<Course[]>("GET", "/me/courses", { query: { limit, offset } })) ?? []

/** Every published course with its free-preview counts; any logged-in user. */
/** Ready videos across my courses (or one of them), with my progress. */
export const listMyVideos = async (courseId?: string) =>
  (await json<MyVideo[]>("GET", "/me/videos", { query: { courseId } })) ?? []

/** Quizzes across my courses (or one of them), with my attempts. */
export const listMyQuizzes = async (courseId?: string, type?: QuizType) =>
  (await json<MyQuiz[]>("GET", "/me/quizzes", { query: { courseId, type } })) ?? []

export const getMyProgress = () => json<ProgressSummary>("GET", "/me/progress")

// The students of the caller's own courses (instructors and admins); the server never returns anyone else's.
export const listStudents = async (courseId?: string) =>
  (await json<StudentProgress[]>("GET", "/instructor/students", { query: { courseId } })) ?? []

export const getStudent = (studentId: string) => json<StudentDetail>("GET", `/instructor/students/${id(studentId)}`)

export const listCatalog = async (freeOnly = false, limit = 100, offset = 0) =>
  (await json<CatalogCourse[]>("GET", "/catalog/courses", {
    query: { freeOnly: freeOnly ? "true" : undefined, limit, offset },
  })) ?? []

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

/** Course owner only. Private hides the course from everyone not enrolled; enrolled students keep access until it expires. */
export const updateCourseVisibility = (courseId: string, visibility: CourseVisibility) =>
  json<Course>("PATCH", `/courses/${id(courseId)}/visibility`, { body: { visibility } })

/**
 * Course owner only. Starts the next batch: a draft copy with the lessons, PDF notes, offline recordings,
 * tests and flashcards, but no Meet recordings and no students. Title and slug default to the source's.
 */
export const createCourseBatch = (courseId: string, input: { title?: string; slug?: string } = {}) =>
  json<Course>("POST", `/courses/${id(courseId)}/batches`, { body: input })

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
  input: { title: string; description?: string; tiers: ContentTier[]; file: File }
) => {
  const form = new FormData()
  form.set("title", input.title)
  if (input.description) form.set("description", input.description)
  // A blank field means Ultra only; leaving it out would give the server's default tiers.
  if (input.tiers.length) for (const t of input.tiers) form.append("tiers", t)
  else form.set("tiers", "")
  form.set("file", input.file)
  return json<Note>("POST", `/lessons/${id(lessonId)}/notes`, { form })
}

/** Changes only the fields sent; the PDF itself can't be replaced. */
export const updateNote = (noteId: string, input: Partial<{ title: string; description: string; tiers: ContentTier[] }>) =>
  json<Note>("PATCH", `/notes/${id(noteId)}`, { body: input })

export const deleteNote = (noteId: string) =>
  json<string>("DELETE", `/notes/${id(noteId)}`)

/**
 * Fetches the PDF as a Blob (the cookie-authenticated endpoint cannot be used as a plain link).
 * The server scrambles it so the raw response is not a usable file: a 16-byte AES key,
 * a 16-byte counter block, then the PDF encrypted with AES-CTR. It is decrypted here, in memory.
 */
export async function downloadNote(noteId: string): Promise<Blob> {
  const res = await call("GET", `/notes/${id(noteId)}/file`)
  if (!res.ok) return fail(res)
  const buf = new Uint8Array(await res.arrayBuffer())
  const key = await crypto.subtle.importKey("raw", buf.subarray(0, 16), "AES-CTR", false, ["decrypt"])
  const pdf = await crypto.subtle.decrypt({ name: "AES-CTR", counter: buf.subarray(16, 32), length: 128 }, key, buf.subarray(32))
  return new Blob([pdf], { type: "application/pdf" })
}

// ── videos ──────────────────────────────────────────────────────────────────
export const VIDEO_EXT_RE = /\.(mp4|mov|mkv|webm)$/i
export const MAX_VIDEO = 5 * 1024 * 1024 * 1024 // 5 GB, enforced by the signed URL too

/** Owner sees every video; students see ready videos of published lessons, locked when their tier can't stream them. */
export const listCourseVideos = async (courseId: string, kind?: VideoKind) =>
  (await json<{ videos: Video[] | null }>("GET", `/courses/${id(courseId)}/videos`, { query: { kind } }))?.videos ?? []

export const listLessonVideos = async (lessonId: string, kind?: VideoKind) =>
  (await json<{ videos: Video[] | null }>("GET", `/lessons/${id(lessonId)}/videos`, { query: { kind } }))?.videos ?? []

/** Creates the video row ('uploading') and returns a signed URL to PUT the file to. */
export const requestVideoUpload = (
  lessonId: string,
  input: { fileName: string; description?: string; kind: VideoKind; tiers: ContentTier[] }
) =>
  json<VideoUpload>("POST", `/lessons/${id(lessonId)}/videos`, { body: input })

/** Uploader only. An empty description removes it; `kind` moves the video to the other section. */
export const updateVideo = async (
  videoId: string,
  input: Partial<{ title: string; description: string; kind: VideoKind; tiers: ContentTier[] }>
) =>
  (await json<{ video: Video }>("PATCH", `/videos/${id(videoId)}`, { body: input })).video

/** Tells the server the PUT finished; it checks the file and queues transcoding. */
export const confirmVideo = async (videoId: string) =>
  (await json<{ video: Video }>("POST", `/videos/${id(videoId)}/confirm`)).video

export const getVideo = async (videoId: string) =>
  (await json<{ video: Video }>("GET", `/videos/${id(videoId)}`)).video

export const getVideoStream = (videoId: string) =>
  json<VideoStream>("GET", `/videos/${id(videoId)}/stream`)

/**
 * `keepalive` lets the save finish while the page unloads. Sending the duration lets the server mark the
 * video completed once 90% of it is reached.
 */
export const saveVideoProgress = (videoId: string, positionSec: number, keepalive = false, durationSec?: number) =>
  json<{ positionSec: number }>("PUT", `/videos/${id(videoId)}/progress`, {
    body: {
      positionSec: Math.max(0, Math.min(86_400, Math.floor(positionSec))),
      ...(durationSec && Number.isFinite(durationSec) && durationSec >= 1
        ? { durationSec: Math.min(86_400, Math.round(durationSec)) }
        : {}),
    },
    keepalive,
  })

/** Ticks a video off (or back on) in my progress. */
export const setVideoCompletion = (videoId: string, completed: boolean) =>
  json<{ completed: boolean }>("PUT", `/videos/${id(videoId)}/completion`, { body: { completed } })

/** Re-queues transcoding of a failed video; the uploaded file is reused. */
/** Owner only. 409 while the video is still processing; its files are removed from storage afterwards. */
export const deleteVideo = (videoId: string) =>
  json<string>("DELETE", `/videos/${id(videoId)}`)

export const retryVideo = async (videoId: string) =>
  (await json<{ video: Video }>("POST", `/videos/${id(videoId)}/retry`)).video

/** True while the signed upload URL has at least a minute left, so a retry can reuse it. */
export const uploadUrlFresh = (upload: VideoUpload) => Date.parse(upload.expiresAt) - Date.now() > 60_000

/**
 * PUTs the file straight to storage. Uses XHR (not fetch) for upload progress.
 * No cookies are sent: the signature in the URL is the credential.
 */
export function putVideoFile(
  upload: VideoUpload,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(upload.method || "PUT", upload.uploadUrl)
    // The signed headers must be sent unchanged, or storage rejects the signature.
    const headers = { "x-goog-content-length-range": `0,${MAX_VIDEO}`, ...upload.headers }
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => onProgress(e.loaded, e.lengthComputable ? e.total : file.size)
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(`Upload rejected by storage (HTTP ${xhr.status}).`, xhr.status))
    xhr.onerror = () => reject(new ApiError("Upload failed. Check your connection and try again.", 0))
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"))
    signal?.addEventListener("abort", () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

// ── enrollments ─────────────────────────────────────────────────────────────
export const listEnrollments = async (
  filter: { courseId?: string; userId?: string } = {},
  limit = 50,
  offset = 0
) =>
  (await json<Enrollment[]>("GET", "/enrollments", { query: { ...filter, limit, offset } })) ?? []

export const createEnrollment = (input: { userId: string; courseId: string; months: number; tier: EnrollmentTier }) =>
  json<Enrollment>("POST", "/enrollments", { body: input })

/** Changes only the fields sent. */
export const updateEnrollment = (enrollmentId: string, input: { status?: EnrollmentStatus; tier?: EnrollmentTier }) =>
  json<Enrollment>("PATCH", `/enrollments/${id(enrollmentId)}`, { body: input })

export const updateEnrollmentStatus = (enrollmentId: string, status: EnrollmentStatus) =>
  updateEnrollment(enrollmentId, { status })

// ── posts ───────────────────────────────────────────────────────────────────
export const listPosts = async (limit = 50, offset = 0) =>
  (await json<Post[]>("GET", "/posts", { query: { limit, offset } })) ?? []

export const createPost = (input: { courseId: string; content: string; links?: string[] }) =>
  json<Post>("POST", "/posts", { body: input })

export const deletePost = (postId: string) => json<string>("DELETE", `/posts/${id(postId)}`)

// ── quizzes ─────────────────────────────────────────────────────────────────
export const listQuizzes = async (lessonId: string, type?: QuizType) =>
  (await json<Quiz[]>("GET", `/lessons/${id(lessonId)}/quizzes`, { query: { type } })) ?? []

export const createQuiz = (
  lessonId: string,
  input: {
    title: string
    type?: QuizType
    description?: string
    tiers?: ContentTier[]
    /** Not allowed for practice sets. */
    passPercent?: number
    /** Not allowed for practice sets. */
    timeLimitSec?: number
    status?: QuizStatus
    questions: NewQuestion[]
  }
) => json<Quiz>("POST", `/lessons/${id(lessonId)}/quizzes`, { body: input })

export const updateQuiz = (
  quizId: string,
  input: Partial<{
    title: string
    /** 409 once the quiz has attempts. */
    type: QuizType
    description: string
    tiers: ContentTier[]
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

/** Practice only: grades one answer right away (correct option + explanation). Nothing is saved. */
export const checkAnswer = (quizId: string, questionId: string, optionId: string) =>
  json<AttemptAnswer>("POST", `/quizzes/${id(quizId)}/check`, { body: { questionId, optionId } })

/** Practice only: saves a finished session and returns it graded, for the review page. */
export const submitAttempt = (
  quizId: string,
  answers: { questionId: string; optionId: string }[]
) => json<QuizAttempt>("POST", `/quizzes/${id(quizId)}/attempts`, { body: { answers } })

/** Mock tests only: grades and saves the test; returns the marks with every answer revealed. */
export const submitMockTest = (
  quizId: string,
  answers: { questionId: string; optionId: string }[]
) => json<MockResult>("POST", `/quizzes/${id(quizId)}/submit`, { body: { answers } })

export const listAttempts = async (quizId: string) =>
  (await json<QuizAttempt[]>("GET", `/quizzes/${id(quizId)}/attempts`)) ?? []

// ── flashcards ──────────────────────────────────────────────────────────────
/** A course's decks (one per lesson plus the course-wide one). Owners also get drafts. */
export const listCourseDecks = async (courseId: string) =>
  (await json<FlashcardDeck[]>("GET", `/courses/${id(courseId)}/flashcard-decks`)) ?? []

/** lessonId null makes the course-wide deck. 409 if it already exists. */
export const createDeck = (courseId: string, input: { lessonId: string | null; status: DeckStatus }) =>
  json<FlashcardDeck>("POST", `/courses/${id(courseId)}/flashcard-decks`, {
    body: { status: input.status, ...(input.lessonId ? { lessonId: input.lessonId } : {}) },
  })

export const updateDeckStatus = (deckId: string, status: DeckStatus) =>
  json<FlashcardDeck>("PATCH", `/flashcard-decks/${id(deckId)}`, { body: { status } })

/** Gives every card of the deck the same tiers at once. */
export const setDeckTiers = (deckId: string, tiers: ContentTier[]) =>
  json<FlashcardDeck>("PUT", `/flashcard-decks/${id(deckId)}/tiers`, { body: { tiers } })

export const deleteDeck = (deckId: string) => json<string>("DELETE", `/flashcard-decks/${id(deckId)}`)

export const listDeckCards = async (deckId: string) =>
  (await json<Flashcard[]>("GET", `/flashcard-decks/${id(deckId)}/cards`)) ?? []

export const createFlashcard = (deckId: string, input: { front: string; back: string; tiers: ContentTier[] }) =>
  json<Flashcard>("POST", `/flashcard-decks/${id(deckId)}/cards`, { body: input })

export const updateFlashcard = (
  cardId: string,
  input: Partial<{ front: string; back: string; tiers: ContentTier[] }>,
) => json<Flashcard>("PATCH", `/flashcards/${id(cardId)}`, { body: input })

export const deleteFlashcard = (cardId: string) => json<string>("DELETE", `/flashcards/${id(cardId)}`)

/** Distinct cards of a deck in random order; cards I rated low come up more. Only cards my tier can study. */
export const getDeckSession = async (deckId: string, limit?: number) =>
  (await json<Flashcard[]>("GET", `/flashcard-decks/${id(deckId)}/session`, { query: { limit } })) ?? []

export const getMyFlashcards = async (courseId?: string) =>
  (await json<MyFlashcards>("GET", "/me/flashcards", { query: { courseId } })) ?? { recent: null, decks: [] }

/** A random mix across my courses (or one of them). */
export const getMixSession = async (courseId?: string, limit?: number) =>
  (await json<Flashcard[]>("GET", "/me/flashcards/session", { query: { courseId, limit } })) ?? []

export const reviewFlashcard = (cardId: string, rating: FlashcardRating) =>
  json<string>("PUT", `/flashcards/${id(cardId)}/review`, { body: { rating } })

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

