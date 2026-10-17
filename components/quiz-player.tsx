"use client"

import { ArrowCounterClockwiseIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, CircleNotchIcon, ClockIcon, MinusCircleIcon, PaperPlaneTiltIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useState } from "react"

import { ErrorNote } from "@/components/app-shell"
import { useQuizSession } from "@/components/quiz-session"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { AttemptAnswer, MockResult, Question, Quiz } from "@/lib/api"

const LETTERS = "ABCDEFGHIJ"

/** The test in progress, then the mock score or the practice review. Must sit inside <QuizSessionProvider>. */
export function QuizPlayer({ onRestart, onExit }: { onRestart: () => void; onExit: () => void }) {
  const { quiz, practice, state } = useQuizSession()
  if (state.status !== "finished") return <Runner />
  if (!practice && state.mockResult) return <MockScore result={state.mockResult} onRestart={onRestart} onExit={onExit} />
  return (
    <PracticeReview
      quiz={quiz}
      answers={state.review ?? []}
      actions={
        <>
          <Button onClick={onRestart}>
            <ArrowCounterClockwiseIcon /> Practice again
          </Button>
          <Button variant="outline" onClick={onExit}>
            Practice section
          </Button>
        </>
      }
    />
  )
}

function Runner() {
  const { questions, practice, state, current, done, remaining, go, pick, check, finish } = useQuizSession()
  const total = questions.length
  const last = state.index === total - 1
  const picked = state.picked[current.id]
  const result = practice ? state.checked[current.id] : undefined
  const submitting = state.status === "submitting"

  // Asking before a submit that can't be undone (or a practice finish with gaps) happens in a dialog.
  const [asking, setAsking] = useState(false)
  const left = total - done

  function submit() {
    if (practice && left === 0) return void finish()
    setAsking(true)
  }

  function primary() {
    if (practice && !result) return void (picked && check())
    if (last) return submit()
    go(state.index + 1)
  }

  // Leaving the page mid-test would lose the answers.
  useEffect(() => {
    if (done === 0) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  })

  // 1–9 / A–J pick an option, ←/→ move, Enter checks or goes on.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (asking) return // the dialog owns the keyboard while it is open
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest("textarea, select, [contenteditable], input:not([type=radio])")) return
      const n = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : LETTERS.indexOf(e.key.toUpperCase())
      if (n >= 0 && n < current.options.length) {
        pick(current.options[n].id)
      } else if (e.key === "ArrowRight" && el.tagName !== "INPUT") {
        go(state.index + 1)
      } else if (e.key === "ArrowLeft" && el.tagName !== "INPUT") {
        go(state.index - 1)
      } else if (e.key === "Enter" && el.tagName !== "BUTTON" && !submitting && !state.checking) {
        primary()
      } else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="space-y-4">
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={left > 0 ? "bg-amber-50 text-amber-600" : "bg-accent text-primary"}>
              {left > 0 ? <WarningCircleIcon weight="duotone" /> : <PaperPlaneTiltIcon weight="duotone" />}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {practice
                ? `Finish with ${left} unanswered?`
                : left > 0
                  ? `Submit with ${left} unanswered?`
                  : "Submit your test?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {practice
                ? "You'll see the review with every answer and explanation, including the ones you skipped."
                : left > 0
                  ? "Unanswered questions count as wrong. You can't change your answers after you submit."
                  : `You've answered all ${total} questions. You can't change your answers after you submit.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="tnum grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
            <div className="bg-white px-4 py-3">
              <dt className="text-xs text-muted-foreground">Answered</dt>
              <dd className="mt-0.5 font-medium text-heading">
                {done} <span className="font-normal text-gray-400">of {total}</span>
              </dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-xs text-muted-foreground">{remaining !== null ? "Time left" : "Unanswered"}</dt>
              <dd className="mt-0.5 font-medium text-heading">
                {remaining !== null ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : left}
              </dd>
            </div>
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel>{left > 0 ? "Keep answering" : "Review answers"}</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={() => {
                setAsking(false)
                void finish()
              }}
            >
              {submitting && <CircleNotchIcon className="animate-spin" />}
              {practice ? "Finish & review" : "Submit test"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="sticky top-[88px] z-20 space-y-3 rounded-lg border border-border bg-white/95 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="tnum text-base font-semibold text-heading">
              Question {state.index + 1} <span className="font-normal text-gray-500">of {total}</span>
            </span>
            <span className="tnum text-sm text-gray-500">{total - done} left</span>
          </div>
          <div className="flex items-center gap-2">
            {remaining !== null && (
              <span
                className={"tnum flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-bold " + (remaining <= 30 ? "bg-red-50 text-red-700" : "bg-mint text-teal")}
                aria-label="Time left"
              >
                <ClockIcon className="size-3.5" />
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={submit} disabled={submitting}>
              {practice ? "Finish" : "Submit test"}
            </Button>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-teal transition-[width] duration-500 ease-out" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>

      <Card key={current.id} className="rise bg-white">
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-teal">Question {state.index + 1}</span>
            {result && <StatusBadge status={result.isCorrect ? "correct" : "wrong"} />}
          </div>
          <p className="text-lg leading-snug font-semibold whitespace-pre-line text-heading">{current.questionText}</p>

          {result ? (
            <OptionReveal options={current.options} correctOptionId={result.correctOptionId} selectedOptionId={result.selectedOptionId} />
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label={`Question ${state.index + 1}`}>
              {current.options.map((o, i) => {
                const on = picked === o.id
                return (
                  <label
                    key={o.id}
                    className={
                      "flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring " +
                      (on ? "border-teal bg-mint font-medium text-heading" : "border-border text-gray-700 hover:border-teal/40 hover:bg-gray-50")
                    }
                  >
                    <input type="radio" name={current.id} className="sr-only" checked={on} onChange={() => pick(o.id)} disabled={submitting || state.checking} />
                    <Letter i={i} on={on} />
                    <span className="whitespace-pre-line">{o.optionText}</span>
                  </label>
                )
              })}
            </div>
          )}

          {result && <Feedback answer={result} options={current.options} />}
        </CardContent>
      </Card>

      <ErrorNote error={state.error} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => go(state.index - 1)} disabled={state.index === 0}>
          <ArrowLeftIcon /> Previous
        </Button>
        <div className="flex flex-wrap gap-2">
          {practice && !result && (
            <Button variant="ghost" onClick={() => (last ? submit() : go(state.index + 1))} disabled={submitting || state.checking}>
              {last ? "Finish & review" : "Skip"}
            </Button>
          )}
          <Button onClick={primary} disabled={submitting || state.checking || (practice && !result && !picked)}>
            {(submitting || state.checking) && <CircleNotchIcon className="animate-spin" />}
            {practice && !result ? "Check answer" : last ? (practice ? "Finish & review" : "Submit test") : "Next"}
            {!last && !(practice && !result) && <ArrowRightIcon />}
          </Button>
        </div>
      </div>

      <QuestionGrid />
    </div>
  )
}

/** Jump to any question; shows which are answered (mock) or right/wrong (practice). */
function QuestionGrid() {
  const { questions, practice, state, go } = useQuizSession()
  return (
    <nav aria-label="All questions" className="space-y-3 rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span className="font-medium">All questions</span>
        <span className="flex flex-wrap gap-3">
          {practice ? (
            <>
              <Legend className="border-green-600/30 bg-lime-soft">Right</Legend>
              <Legend className="border-red-200 bg-red-50">Wrong</Legend>
            </>
          ) : (
            <Legend className="border-teal bg-teal">Answered</Legend>
          )}
          <Legend className="border-border bg-white">Not answered</Legend>
        </span>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const checked = state.checked[q.id]
          const answered = practice ? !!checked : !!state.picked[q.id]
          const tone = practice
            ? checked
              ? checked.isCorrect
                ? "border-green-600/30 bg-lime-soft text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
              : "border-border bg-white text-gray-600 hover:border-teal/40"
            : answered
              ? "border-teal bg-teal text-white"
              : "border-border bg-white text-gray-600 hover:border-teal/40"
          const here = i === state.index
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={here ? "step" : undefined}
                aria-label={`Question ${i + 1}, ${practice && checked ? (checked.isCorrect ? "right" : "wrong") : answered ? "answered" : "not answered"}`}
                className={"tnum grid size-9 place-items-center rounded-md border text-xs font-semibold transition-colors " + tone + (here ? " ring-2 ring-heading ring-offset-1" : "")}
              >
                {i + 1}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={"size-3 rounded-sm border " + className} />
      {children}
    </span>
  )
}

function Letter({ i, on, className = "" }: { i: number; on?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition-colors " +
        (on ? "border-teal bg-teal text-white" : "border-gray-300 text-gray-500") +
        " " +
        className
      }
    >
      {LETTERS[i]}
    </span>
  )
}

/** Practice: right or wrong, the right option if missed, and why. */
function Feedback({ answer, options }: { answer: AttemptAnswer; options: Question["options"] }) {
  const correct = options.findIndex((o) => o.id === answer.correctOptionId)
  return (
    <div
      role="status"
      className={"pop space-y-1 rounded-md border px-4 py-3 text-sm " + (answer.isCorrect ? "border-green-600/30 bg-lime-soft/50" : "border-red-200 bg-red-50")}
    >
      <p className={"flex items-center gap-2 font-semibold " + (answer.isCorrect ? "text-green-700" : "text-red-700")}>
        {answer.isCorrect ? <CheckCircleIcon className="size-4" /> : <XCircleIcon className="size-4" />}
        {answer.isCorrect ? "Correct" : `Not quite. The right answer is ${LETTERS[correct] ?? "marked in green"}.`}
      </p>
      {answer.explanation && <p className="leading-relaxed whitespace-pre-line text-gray-700">{answer.explanation}</p>}
    </div>
  )
}

/** Options with the correct one in green and a wrong pick in red. */
function OptionReveal({
  options,
  correctOptionId,
  selectedOptionId,
}: {
  options: Question["options"]
  correctOptionId?: string
  selectedOptionId?: string | null
}) {
  return (
    <ul className="space-y-2 text-sm">
      {options.map((o, i) => {
        const correct = o.id === correctOptionId
        const wrongPick = !correct && o.id === selectedOptionId
        return (
          <li
            key={o.id}
            className={
              "flex items-center gap-3 rounded-md border px-4 py-3 " +
              (correct
                ? "border-green-600/30 bg-lime-soft/60 font-medium text-green-700"
                : wrongPick
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-border text-gray-500")
            }
          >
            <Letter i={i} className={correct ? "border-green-600 bg-green-600 text-white" : wrongPick ? "border-red-600 bg-red-600 text-white" : ""} />
            <span className="flex-1 whitespace-pre-line">{o.optionText}</span>
            {o.id === selectedOptionId && <span className="text-xs font-semibold">Your answer</span>}
          </li>
        )
      })}
    </ul>
  )
}

type ReviewStatus = "correct" | "wrong" | "skipped"

function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "correct")
    return (
      <Badge variant="lime" className="text-green-700">
        <CheckCircleIcon /> Correct
      </Badge>
    )
  if (status === "wrong")
    return (
      <Badge variant="destructive">
        <XCircleIcon /> Wrong
      </Badge>
    )
  return (
    <Badge variant="outline" className="text-gray-500">
      <MinusCircleIcon /> Skipped
    </Badge>
  )
}

/** Mock test result: marks only, never the answers. */
function MockScore({ result, onRestart, onExit }: { result: MockResult; onRestart: () => void; onExit: () => void }) {
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0
  return (
    <div className="space-y-4">
      <Card className="pop overflow-hidden bg-navy">
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-white/75">Your score</div>
              <div className="tnum text-6xl font-semibold text-white">
                {result.score}
                <span className="text-3xl text-white/60">/{result.total}</span>
              </div>
            </div>
            <Badge variant={result.passed ? "lime" : "secondary"} className="h-7 px-3 text-xs">
              {result.passed ? "Passed" : "Not passed"}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="tnum flex justify-between text-sm text-white/80">
              <span>{pct}%</span>
              <span>Pass mark {result.passPercent}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/15">
              <div className="h-full rounded-full bg-secondary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
              <div aria-hidden className="absolute -inset-y-1 w-0.5 rounded-full bg-white" style={{ left: `${result.passPercent}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>
      <p className="text-sm text-gray-600">Mock test answers stay hidden, like in the real exam. Revise the lesson and try again to improve your score.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRestart}>
          <ArrowCounterClockwiseIcon /> Retake test
        </Button>
        <Button variant="outline" onClick={onExit}>
          Practice section
        </Button>
      </div>
    </div>
  )
}

/** Every question of a practice session: what you picked, the right answer, and why. Questions you skipped stay unrevealed. */
export function PracticeReview({ quiz, answers, actions }: { quiz: Quiz; answers: AttemptAnswer[]; actions?: React.ReactNode }) {
  const [filter, setFilter] = useState<ReviewStatus | "all">("all")
  const byQ = new Map(answers.map((a) => [a.questionId, a]))
  const rows = (quiz.questions ?? []).map((q, i) => {
    const a = byQ.get(q.id)
    const status: ReviewStatus = !a ? "skipped" : a.isCorrect ? "correct" : "wrong"
    return { q, i, a, status }
  })
  const count = (s: ReviewStatus) => rows.filter((r) => r.status === s).length
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter)
  const filters: { key: ReviewStatus | "all"; label: string; n: number }[] = [
    { key: "all", label: "All", n: rows.length },
    { key: "wrong", label: "Wrong", n: count("wrong") },
    { key: "correct", label: "Correct", n: count("correct") },
    { key: "skipped", label: "Skipped", n: count("skipped") },
  ]

  return (
    <div className="space-y-4">
      <Card className="pop overflow-hidden bg-navy">
        <CardContent className="space-y-5">
          <div className="space-y-1">
            <div className="text-sm text-white/75">Practice review</div>
            <div className="tnum text-5xl font-semibold text-white">
              {count("correct")}
              <span className="text-2xl text-white/60"> of {rows.length} right</span>
            </div>
          </div>
          <div className="tnum flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <CheckCircleIcon className="size-4 text-secondary" /> {count("correct")} correct
            </span>
            <span className="flex items-center gap-1.5">
              <XCircleIcon className="size-4 text-red-300" /> {count("wrong")} wrong
            </span>
            <span className="flex items-center gap-1.5">
              <MinusCircleIcon className="size-4 text-white/50" /> {count("skipped")} skipped
            </span>
          </div>
        </CardContent>
      </Card>

      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

      <div className="flex flex-wrap gap-2" aria-label="Show questions">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={
              "tnum rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
              (filter === f.key ? "border-teal bg-teal text-white" : "border-border bg-white text-gray-600 hover:border-teal/40")
            }
          >
            {f.label} · {f.n}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="text-sm text-gray-500">No {filter} questions in this session.</p>}

      {shown.map(({ q, i, a, status }, k) => (
        <Card key={q.id} className="rise bg-white" style={{ "--i": Math.min(k, 8) } as React.CSSProperties}>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-teal">Question {i + 1}</span>
              <StatusBadge status={status} />
            </div>
            <p className="text-base leading-snug font-semibold whitespace-pre-line text-heading">{q.questionText}</p>
            {a ? (
              <>
                <OptionReveal options={q.options} correctOptionId={a.correctOptionId} selectedOptionId={a.selectedOptionId} />
                {a.explanation && (
                  <div className="rounded-md bg-mint/70 px-4 py-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-teal">Explanation</p>
                    <p className="leading-relaxed whitespace-pre-line text-gray-700">{a.explanation}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <OptionReveal options={q.options} />
                <p className="text-xs text-gray-500">You skipped this one. Answer it next practice to see the explanation.</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
