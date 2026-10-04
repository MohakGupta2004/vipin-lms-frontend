"use client"

import { CheckCircle2, Loader2, Pencil, Trash2, XCircle } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuizBuilder } from "@/components/quiz-builder"
import { Select } from "@/components/ui/select"
import { useUser } from "@/hooks/use-user"
import {
  UUID_RE,
  deleteQuiz,
  getCourse,
  getQuiz,
  listAttempts,
  submitAttempt,
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
  const [result, setResult] = useState<QuizAttempt | null>(null)
  const [error, setError] = useState<string | null>(valid ? null : "That is not a valid quiz ID.")
  const [taking, setTaking] = useState(false)
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

  const questions = quiz?.questions ?? []

  return (
    <>
      <PageTitle
        title={quiz?.title ?? "Quiz"}
        subtitle={quiz?.description}
        actions={
          owner && quiz && (
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Quiz status" className="h-9 w-36" value={quiz.status} onChange={(e) => onStatus(e.target.value as QuizStatus)}>
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
        <div className="flex flex-wrap gap-2 text-sm text-gray-600">
          <Badge variant="secondary">{quiz.questionCount} questions</Badge>
          <Badge variant="secondary">Pass mark {quiz.passPercent}%</Badge>
          <Badge variant="secondary">{quiz.timeLimitSec ? `${Math.round(quiz.timeLimitSec / 60)} min limit` : "Untimed"}</Badge>
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

      {isStudent && quiz && !result && !taking && (
        <Button onClick={() => setTaking(true)} disabled={questions.length === 0}>
          Start quiz
        </Button>
      )}

      {isStudent && quiz && taking && !result && (
        <Take
          quiz={quiz}
          onDone={(a) => {
            setResult(a)
            setTaking(false)
            setAttempts((x) => [a, ...x])
          }}
        />
      )}

      {result && quiz && <Result quiz={quiz} attempt={result} />}

      {isStudent && attempts.length > 0 && (
        <Card className="bg-white shadow-xs">
          <CardHeader>
            <CardTitle>My attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-100 text-sm">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span>{new Date(a.submittedAt).toLocaleString()}</span>
                  <span className="flex items-center gap-2">
                    {a.score}/{a.total}
                    <Badge variant={a.passed ? "default" : "secondary"}>{a.passed ? "Passed" : "Not passed"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function Answers({ questions }: { questions: NonNullable<Quiz["questions"]> }) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <Card key={q.id} className="bg-white shadow-xs">
          <CardContent className="space-y-2">
            <p className="font-medium text-gray-900">
              {i + 1}. {q.questionText}
            </p>
            <ul className="space-y-1 text-sm">
              {q.options.map((o) => (
                <li key={o.id} className={o.isCorrect ? "font-medium text-green-700" : "text-gray-700"}>
                  {o.isCorrect ? "✓ " : "• "}
                  {o.optionText}
                </li>
              ))}
            </ul>
            {q.explanation && <p className="text-xs text-gray-500">{q.explanation}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function Take({ quiz, onDone }: { quiz: Quiz; onDone: (a: QuizAttempt) => void }) {
  const questions = quiz.questions ?? []
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [left, setLeft] = useState(quiz.timeLimitSec ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitted = useRef(false)

  const submit = useCallback(async () => {
    if (submitted.current) return
    submitted.current = true
    setSaving(true)
    setError(null)
    try {
      onDone(
        await submitAttempt(
          quiz.id,
          Object.entries(picked).map(([questionId, optionId]) => ({ questionId, optionId }))
        )
      )
    } catch (e) {
      submitted.current = false
      setError(errMsg(e))
      setSaving(false)
    }
  }, [quiz.id, picked, onDone])

  // The time limit is advisory in the UI; the server grades whatever is submitted.
  useEffect(() => {
    if (left === null) return
    const t = setTimeout(
      () => (left <= 0 ? submit() : setLeft((s) => (s === null ? s : s - 1))),
      left <= 0 ? 0 : 1000
    )
    return () => clearTimeout(t)
  }, [left, submit])

  return (
    <div className="space-y-4">
      {left !== null && (
        <p className="text-sm font-medium text-gray-900" aria-live="off">
          Time left: {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </p>
      )}
      {questions.map((q, i) => (
        <Card key={q.id} className="bg-white shadow-xs">
          <CardContent className="space-y-3">
            <p className="font-medium text-gray-900">
              {i + 1}. {q.questionText}
            </p>
            <div className="space-y-2" role="radiogroup" aria-label={`Question ${i + 1}`}>
              {q.options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm text-gray-800">
                  <input type="radio" name={q.id} checked={picked[q.id] === o.id} onChange={() => setPicked((p) => ({ ...p, [q.id]: o.id }))} />
                  {o.optionText}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <ErrorNote error={error} />
      <Button onClick={submit} disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Submit answers
      </Button>
    </div>
  )
}

function Result({ quiz, attempt }: { quiz: Quiz; attempt: QuizAttempt }) {
  const byQ = new Map((attempt.answers ?? []).map((a) => [a.questionId, a]))
  return (
    <div className="space-y-3">
      <Card className="bg-white shadow-xs">
        <CardContent className="flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900">
            Score: {attempt.score}/{attempt.total}
          </div>
          <Badge variant={attempt.passed ? "default" : "secondary"}>{attempt.passed ? "Passed" : "Not passed"}</Badge>
        </CardContent>
      </Card>
      {(quiz.questions ?? []).map((q, i) => {
        const a = byQ.get(q.id)
        return (
          <Card key={q.id} className="bg-white shadow-xs">
            <CardContent className="space-y-2">
              <p className="flex items-start gap-2 font-medium text-gray-900">
                {a?.isCorrect ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />}
                {i + 1}. {q.questionText}
              </p>
              <ul className="space-y-1 text-sm">
                {q.options.map((o) => (
                  <li
                    key={o.id}
                    className={
                      o.id === a?.correctOptionId
                        ? "font-medium text-green-700"
                        : o.id === a?.selectedOptionId
                          ? "text-red-700"
                          : "text-gray-700"
                    }
                  >
                    {o.id === a?.correctOptionId ? "✓ " : o.id === a?.selectedOptionId ? "✗ " : "• "}
                    {o.optionText}
                  </li>
                ))}
              </ul>
              {!a?.selectedOptionId && <p className="text-xs text-gray-500">Skipped</p>}
              {a?.explanation && <p className="text-xs text-gray-500">{a.explanation}</p>}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
