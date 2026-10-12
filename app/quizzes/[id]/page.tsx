"use client"

import { CheckCircle2, Loader2, Pencil, Trash2 } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuizBuilder } from "@/components/quiz-builder"
import { PracticeReview, QuizPlayer } from "@/components/quiz-player"
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
      <QuizView />
    </AppShell>
  )
}

function QuizView() {
  const user = useUser()!
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const valid = UUID_RE.test(id)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [error, setError] = useState<string | null>(valid ? null : "That is not a valid test ID.")
  // Key of the run in progress (bumped by "try again" for a fresh session); null shows the overview.
  const [run, setRun] = useState<number | null>(null)
  // A past practice session opened from the history.
  const [reviewing, setReviewing] = useState<QuizAttempt | null>(null)
  const [editing, setEditing] = useState(false)
  const [owner, setOwner] = useState(false)
  const isStudent = user.role === "student"

  useEffect(() => {
    if (!valid) return
    getQuiz(id)
      .then(async (q) => {
        setQuiz(q)
        // Owner = instructor/admin whose id is the course's instructor id.
        if (!isStudent) {
          const c = await getCourse(q.courseId).catch(() => null)
          setOwner(!!c && c.instructorId === user.id)
        }
      })
      .catch((e) => setError(errMsg(e)))
    if (isStudent) listAttempts(id).then(setAttempts).catch((e) => setError(errMsg(e)))
  }, [id, valid, isStudent, user.id])

  async function onDelete() {
    if (!quiz || !confirm(`Delete "${quiz.title}"? Students' past attempts are kept.`)) return
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

  const onSaved = useCallback((a: QuizAttempt) => setAttempts((x) => [a, ...x]), [])

  const questions = quiz?.questions ?? []
  const practice = !!quiz && isPractice(quiz)

  return (
    <>
      <PageTitle
        title={quiz?.title ?? "Test"}
        subtitle={quiz?.description}
        actions={
          owner && quiz && (
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Test status" className="h-9 w-36" value={quiz.status} onChange={(e) => onStatus(e.target.value as QuizStatus)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </Select>
              <Button variant="outline" onClick={() => setEditing((v) => !v)}>
                <Pencil /> Edit
              </Button>
              <Button variant="destructive" onClick={onDelete}>
                <Trash2 /> Delete
              </Button>
            </div>
          )
        }
      />
      <ErrorNote error={error} />
      {!quiz && !error && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      )}

      {quiz && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{quiz.questionCount} questions</Badge>
          <Badge variant="secondary">{QUIZ_TYPE_LABEL[quiz.type]}</Badge>
          {practice ? (
            <Badge variant="secondary">Untimed · No marks</Badge>
          ) : (
            <>
              <Badge variant="secondary">Pass mark {quiz.passPercent}%</Badge>
              <Badge variant="secondary">{quiz.timeLimitSec ? `${Math.round(quiz.timeLimitSec / 60)} min limit` : "Untimed"}</Badge>
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
        />
      )}

      {!isStudent && quiz && !editing && <Answers questions={questions} />}

      {isStudent && quiz && run !== null && (
        <QuizSessionProvider key={run} quiz={quiz} onSaved={onSaved}>
          <QuizPlayer onRestart={() => setRun((n) => (n ?? 0) + 1)} onExit={() => setRun(null)} />
        </QuizSessionProvider>
      )}

      {isStudent && quiz && run === null && reviewing && (
        <PracticeReview
          quiz={quiz}
          answers={reviewing.answers ?? []}
          actions={
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Back to overview
            </Button>
          }
        />
      )}

      {isStudent && quiz && run === null && !reviewing && (
        <>
          <StartCard quiz={quiz} onStart={() => setRun((n) => (n ?? 0) + 1)} />
          {attempts.length > 0 &&
            (practice ? <PracticeHistory attempts={attempts} onReview={setReviewing} /> : <MockHistory attempts={attempts} />)}
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
        `You'll see only your marks: answers and explanations stay hidden. Pass mark ${quiz.passPercent}%.`,
      ]
  return (
    <Card className="rise bg-white">
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-gray-700">
          {rules.map((r) => (
            <li key={r} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" />
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

function MockHistory({ attempts }: { attempts: QuizAttempt[] }) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>My attempts</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border text-sm">
          {attempts.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span>{new Date(a.submittedAt).toLocaleString()}</span>
              <span className="tnum flex items-center gap-2">
                {a.score ?? 0}/{a.total ?? 0}
                <Badge variant={a.passed ? "default" : "secondary"}>{a.passed ? "Passed" : "Not passed"}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function PracticeHistory({ attempts, onReview }: { attempts: QuizAttempt[]; onReview: (a: QuizAttempt) => void }) {
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
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <span>{new Date(a.submittedAt).toLocaleString()}</span>
                <span className="tnum flex items-center gap-3 text-gray-600">
                  {answers.filter((x) => x.isCorrect).length} of {answers.length} right
                  <Button size="sm" variant="outline" onClick={() => onReview(a)}>
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
        <Card key={q.id} className="rise bg-white" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
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
                    (o.isCorrect ? "border-green-600/30 bg-lime-soft/60 font-medium text-green-700" : "border-border text-gray-700")
                  }
                >
                  {o.isCorrect ? <CheckCircle2 className="size-4 shrink-0" /> : <span className="size-4 shrink-0 rounded-full border border-gray-300" />}
                  {o.optionText}
                </li>
              ))}
            </ul>
            {q.explanation && <p className="text-xs whitespace-pre-line text-gray-500">{q.explanation}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
