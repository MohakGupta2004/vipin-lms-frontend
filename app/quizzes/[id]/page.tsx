"use client"

import {
  CheckCircleIcon,
  CircleNotchIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuizBuilder } from "@/components/quiz-builder"
import {
  MockReview,
  PracticeReview,
  QuizPlayer,
} from "@/components/quiz-player"
import { QuizSessionProvider } from "@/components/quiz-session"
import { Select } from "@/components/ui/select"
import { useUser } from "@/hooks/use-user"
import {
  QUIZ_TYPE_LABEL,
  UUID_RE,
  deleteQuiz,
  getCourse,
  getQuiz,
  isPractice,
  listAttempts,
  updateQuizStatus,
  type Quiz,
  type QuizAttempt,
  type QuizStatus,
} from "@/lib/api"

export default function QuizPage() {
  return (
    <AppShell>
      <Suspense>
        <QuizView />
      </Suspense>
    </AppShell>
  )
}

function QuizView() {
  const user = useUser()!
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const from = params.get("from")
  const via = params.get("via")
  const valid = UUID_RE.test(id)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [error, setError] = useState<string | null>(
    valid ? null : "That is not a valid test ID."
  )
  // Key of the run in progress (bumped by "try again" for a fresh session); null shows the overview.
  const [run, setRun] = useState<number | null>(null)
  // A past attempt opened from the history.
  const [reviewing, setReviewing] = useState<QuizAttempt | null>(null)
  const [editing, setEditing] = useState(false)
  const [owner, setOwner] = useState(false)
  const [courseTitle, setCourseTitle] = useState<string | null>(null)
  const isStudent = user.role === "student"

  useEffect(() => {
    if (!valid) return
    getQuiz(id)
      .then(async (q) => {
        setQuiz(q)
        // Owner = instructor/admin whose id is the course's instructor id. The title labels the back link.
        const c = await getCourse(q.courseId).catch(() => null)
        setCourseTitle(c?.title ?? null)
        if (!isStudent) setOwner(!!c && c.instructorId === user.id)
      })
      .catch((e) => setError(errMsg(e)))
    if (isStudent)
      listAttempts(id)
        .then(setAttempts)
        .catch((e) => setError(errMsg(e)))
  }, [id, valid, isStudent, user.id])

  async function onDelete() {
    if (
      !quiz ||
      !confirm(`Delete "${quiz.title}"? Students' past attempts are kept.`)
    )
      return
    setError(null)
    try {
      await deleteQuiz(id)
      router.replace(`/courses/${quiz.courseId}`)
    } catch (e) {
      setError(errMsg(e))
    }
  }

  async function onStatus(s: QuizStatus) {
    setError(null)
    try {
      const q = await updateQuizStatus(id, s)
      setQuiz((cur) => (cur ? { ...cur, status: q.status } : cur))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const onSaved = useCallback(
    (a: QuizAttempt) => setAttempts((x) => [a, ...x]),
    []
  )

  const questions = quiz?.questions ?? []
  const practice = !!quiz && isPractice(quiz)
  // Students finish back on the tests list, on the right tab, never the course page.
  const testsHref = quiz
    ? `/practice?course=${quiz.courseId}&type=${quiz.type}`
    : "/practice"

  // Where "back" leads for a student: the course (and on to Explore) or the player they came from, else the tests list.
  const studentBack = !quiz
    ? undefined
    : from === "course"
      ? {
          href: `/courses/${quiz.courseId}${via === "explore" ? "?from=explore" : ""}`,
          label: courseTitle ?? "Back to course",
        }
      : from === "learn"
        ? {
            href: `/courses/${quiz.courseId}/learn${via === "explore" ? "?from=course&via=explore" : via === "course" ? "?from=course" : ""}`,
            label: "Course player",
          }
        : { href: testsHref, label: "Practice section" }

  return (
    <>
      {/* Mid-test on a phone the runner's status bar carries the title; the screen belongs to the question. */}
      <div
        className={isStudent && run !== null ? "hidden sm:block" : undefined}
      >
        <PageTitle
          back={
            quiz
              ? isStudent
                ? studentBack
                : {
                    href: `/courses/${quiz.courseId}`,
                    label: courseTitle ?? "Back to course",
                  }
              : undefined
          }
          title={quiz?.title ?? "Test"}
          subtitle={quiz?.description}
          actions={
            owner &&
            quiz && (
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                <Select
                  aria-label="Test status"
                  className="col-span-2 h-9 w-full sm:w-36"
                  value={quiz.status}
                  onChange={(e) => onStatus(e.target.value as QuizStatus)}
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </Select>
                <Button variant="outline" onClick={() => setEditing((v) => !v)}>
                  <PencilSimpleIcon /> Edit
                </Button>
                <Button variant="destructive" onClick={onDelete}>
                  <TrashIcon /> Delete
                </Button>
              </div>
            )
          }
        />
      </div>
      <ErrorNote error={error} />
      {!quiz && !error && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <CircleNotchIcon className="size-4 animate-spin" /> Loading…
        </p>
      )}

      {quiz && (
        // Mid-test on a phone the progress bar already says it all; keep the screen for the question.
        <div
          className={
            "flex-wrap gap-2 " + (run !== null ? "hidden sm:flex" : "flex")
          }
        >
          <Badge variant="secondary">{quiz.questionCount} questions</Badge>
          <Badge variant="secondary">{QUIZ_TYPE_LABEL[quiz.type]}</Badge>
          {practice ? (
            <Badge variant="secondary">Untimed · No marks</Badge>
          ) : (
            <>
              <Badge variant="secondary">Pass mark {quiz.passPercent}%</Badge>
              <Badge variant="secondary">
                {quiz.timeLimitSec
                  ? `${Math.round(quiz.timeLimitSec / 60)} min limit`
                  : "Untimed"}
              </Badge>
            </>
          )}
        </div>
      )}

      {owner && quiz && editing && (
        <QuizBuilder
          key={quiz.id}
          quiz={quiz}
          onSaved={(q) => {
            setQuiz(q)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!isStudent && quiz && !editing && <Answers questions={questions} />}

      {isStudent && quiz && run !== null && (
        <QuizSessionProvider key={run} quiz={quiz} onSaved={onSaved}>
          <QuizPlayer
            onRestart={() => setRun((n) => (n ?? 0) + 1)}
            onExit={() => router.push((studentBack ?? { href: testsHref }).href)}
            exitLabel={studentBack?.label}
          />
        </QuizSessionProvider>
      )}

      {isStudent &&
        quiz &&
        run === null &&
        reviewing &&
        (practice ? (
          <PracticeReview
            quiz={quiz}
            answers={reviewing.answers ?? []}
            actions={
              <Button variant="outline" onClick={() => setReviewing(null)}>
                Back to overview
              </Button>
            }
          />
        ) : (
          <MockReview
            quiz={quiz}
            score={reviewing.score ?? 0}
            total={reviewing.total ?? 0}
            passed={!!reviewing.passed}
            passPercent={quiz.passPercent ?? 0}
            answers={reviewing.answers ?? []}
            actions={
              <Button variant="outline" onClick={() => setReviewing(null)}>
                Back to overview
              </Button>
            }
          />
        ))}

      {isStudent && quiz && run === null && !reviewing && (
        <>
          <StartCard quiz={quiz} onStart={() => setRun((n) => (n ?? 0) + 1)} />
          {attempts.length > 0 &&
            (practice ? (
              <PracticeHistory attempts={attempts} onReview={setReviewing} />
            ) : (
              <MockHistory attempts={attempts} onReview={setReviewing} />
            ))}
          {/* Mock tests: the latest attempt's answers and explanations, right on the overview. */}
          {!practice && !!attempts[0]?.answers?.length && (
            <section aria-labelledby="latest-attempt" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2
                  id="latest-attempt"
                  className="text-lg font-semibold text-heading"
                >
                  Latest attempt
                </h2>
                <span className="text-sm text-gray-500">
                  {new Date(attempts[0].submittedAt).toLocaleString()}
                </span>
              </div>
              <MockReview
                key={attempts[0].id}
                quiz={quiz}
                score={attempts[0].score ?? 0}
                total={attempts[0].total ?? 0}
                passed={!!attempts[0].passed}
                passPercent={quiz.passPercent ?? 0}
                answers={attempts[0].answers}
              />
            </section>
          )}
        </>
      )}
    </>
  )
}

function StartCard({ quiz, onStart }: { quiz: Quiz; onStart: () => void }) {
  const practice = isPractice(quiz)
  const rules = practice
    ? [
        "One question at a time.",
        "Check each answer to see right away whether it's correct, with an explanation.",
        "Skip any question and come back to it.",
        "When you finish, review every answer you got right or wrong.",
      ]
    : [
        "One question at a time. Move between questions and change answers until you submit.",
        quiz.timeLimitSec
          ? `You have ${Math.round(quiz.timeLimitSec / 60)} minutes. The test submits itself when time runs out.`
          : "There is no time limit.",
        "Unanswered questions count as wrong.",
        `After you submit, you'll see your marks and every answer with its explanation. Pass mark ${quiz.passPercent}%.`,
      ]
  return (
    <Card className="rise bg-white">
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-gray-700">
          {rules.map((r) => (
            <li key={r} className="flex gap-2">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-teal" />
              {r}
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={onStart} disabled={!quiz.questions?.length}>
          {practice ? "Start practice" : "Start test"}
        </Button>
      </CardContent>
    </Card>
  )
}

function MockHistory({
  attempts,
  onReview,
}: {
  attempts: QuizAttempt[]
  onReview: (a: QuizAttempt) => void
}) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>My attempts</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border text-sm">
          {attempts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2"
            >
              <span>{new Date(a.submittedAt).toLocaleString()}</span>
              <span className="tnum flex items-center gap-2">
                {a.score ?? 0}/{a.total ?? 0}
                <Badge variant={a.passed ? "default" : "secondary"}>
                  {a.passed ? "Passed" : "Not passed"}
                </Badge>
                {!!a.answers?.length && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReview(a)}
                  >
                    Review
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function PracticeHistory({
  attempts,
  onReview,
}: {
  attempts: QuizAttempt[]
  onReview: (a: QuizAttempt) => void
}) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Past sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border text-sm">
          {attempts.map((a) => {
            const answers = a.answers ?? []
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>{new Date(a.submittedAt).toLocaleString()}</span>
                <span className="tnum flex items-center gap-3 text-gray-600">
                  {answers.filter((x) => x.isCorrect).length} of{" "}
                  {answers.length} right
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReview(a)}
                  >
                    Review
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function Answers({ questions }: { questions: NonNullable<Quiz["questions"]> }) {
  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <Card
          key={q.id}
          className="rise bg-white"
          style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
        >
          <CardContent className="space-y-2">
            <p className="text-base font-semibold whitespace-pre-line text-heading">
              <span className="tnum mr-2 text-teal">{i + 1}.</span>
              {q.questionText}
            </p>
            <ul className="space-y-2 text-sm">
              {q.options.map((o) => (
                <li
                  key={o.id}
                  className={
                    "flex items-center gap-2 rounded-md border px-3 py-2 " +
                    (o.isCorrect
                      ? "border-green-600/30 bg-lime-soft/60 font-medium text-green-700"
                      : "border-border text-gray-700")
                  }
                >
                  {o.isCorrect ? (
                    <CheckCircleIcon className="size-4 shrink-0" />
                  ) : (
                    <span className="size-4 shrink-0 rounded-full border border-gray-300" />
                  )}
                  {o.optionText}
                </li>
              ))}
            </ul>
            {q.explanation && (
              <p className="text-xs whitespace-pre-line text-gray-500">
                {q.explanation}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
