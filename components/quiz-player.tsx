"use client"

import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ClockIcon,
  MinusCircleIcon,
  PaperPlaneTiltIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import { useEffect, useRef, useState } from "react"

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AttemptAnswer, MockResult, Question, Quiz } from "@/lib/api"

const LETTERS = "ABCDEFGHIJ"

/** The test in progress, then the mock score or the practice review. Must sit inside <QuizSessionProvider>. */
export function QuizPlayer({
  onRestart,
  onExit,
}: {
  onRestart: () => void
  onExit: () => void
}) {
  const { quiz, practice, state } = useQuizSession()
  if (state.status !== "finished") return <Runner />
  if (!practice && state.mockResult)
    return (
      <MockScore
        result={state.mockResult}
        onRestart={onRestart}
        onExit={onExit}
      />
    )
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
  const {
    quiz,
    questions,
    practice,
    state,
    current,
    done,
    remaining,
    go,
    pick,
    check,
    finish,
  } = useQuizSession()
  const total = questions.length
  const last = state.index === total - 1
  const picked = state.picked[current.id]
  const result = practice ? state.checked[current.id] : undefined
  const submitting = state.status === "submitting"

  // Asking before a submit that can't be undone (or a practice finish with gaps) happens in a dialog.
  const [asking, setAsking] = useState(false)
  // Phones: the list of all questions lives in a bottom sheet.
  const [navOpen, setNavOpen] = useState(false)
  const left = total - done

  function submit() {
    if (practice && left === 0) return void finish()
    setAsking(true)
  }

  // After "Check answer", bring the verdict and explanation into view (not when revisiting a checked question).
  const feedbackRef = useRef<HTMLDivElement>(null)
  const revealing = useRef<string | null>(null)
  useEffect(() => {
    if (!result || revealing.current !== current.id) return
    revealing.current = null
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Wait a frame so the panel has its final layout before measuring.
    requestAnimationFrame(() =>
      feedbackRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "nearest",
      })
    )
  }, [result, current.id])

  function primary() {
    if (practice && !result) {
      if (picked) {
        revealing.current = current.id
        void check()
      }
      return
    }
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
      if (asking || navOpen) return // the dialog or sheet owns the keyboard while it is open
      const el = e.target as HTMLElement
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        el.closest(
          "textarea, select, [contenteditable], input:not([type=radio])"
        )
      )
        return
      const n = /^[1-9]$/.test(e.key)
        ? Number(e.key) - 1
        : LETTERS.indexOf(e.key.toUpperCase())
      if (n >= 0 && n < current.options.length) {
        pick(current.options[n].id)
      } else if (e.key === "ArrowRight" && el.tagName !== "INPUT") {
        go(state.index + 1)
      } else if (e.key === "ArrowLeft" && el.tagName !== "INPUT") {
        go(state.index - 1)
      } else if (
        e.key === "Enter" &&
        el.tagName !== "BUTTON" &&
        !submitting &&
        !state.checking
      ) {
        primary()
      } else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="space-y-5 sm:space-y-6">
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia
              className={
                left > 0
                  ? "bg-amber-50 text-amber-600"
                  : "bg-accent text-primary"
              }
            >
              {left > 0 ? (
                <WarningCircleIcon weight="duotone" />
              ) : (
                <PaperPlaneTiltIcon weight="duotone" />
              )}
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
                {done}{" "}
                <span className="font-normal text-gray-400">of {total}</span>
              </dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-xs text-muted-foreground">
                {remaining !== null ? "Time left" : "Unanswered"}
              </dt>
              <dd className="mt-0.5 font-medium text-heading">
                {remaining !== null ? clock(remaining) : left}
              </dd>
            </div>
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {left > 0 ? "Keep answering" : "Review answers"}
            </AlertDialogCancel>
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

      {/* Status bar, pinned under the app header (h-14 + safe area). Phones: an edge-to-edge app bar with the progress as its bottom edge. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 bg-white/95 px-4 pt-2.5 pb-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:border-border sm:px-5 sm:py-4 sm:shadow-[0_2px_12px_-4px_rgba(10,37,64,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground sm:hidden">
              {quiz.title}
            </p>
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="-mx-1.5 flex min-h-9 items-center gap-1 rounded-md px-1.5 text-left transition-colors active:bg-gray-100 sm:pointer-events-none sm:mx-0 sm:min-h-0 sm:px-0"
              aria-label={`Question ${state.index + 1} of ${total}. Show all questions`}
            >
              <span className="tnum text-[15px] font-semibold whitespace-nowrap text-heading sm:text-base">
                Question {state.index + 1}
                <span className="font-normal text-gray-500"> of {total}</span>
              </span>
              <CaretDownIcon
                weight="bold"
                className="size-3.5 text-gray-500 sm:hidden"
              />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {remaining !== null && (
              <span
                className={
                  "tnum flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold transition-colors " +
                  (remaining <= 30
                    ? "bg-red-50 text-red-700"
                    : remaining <= 120
                      ? "bg-amber-50 text-amber-700"
                      : "bg-mint text-teal")
                }
                role="timer"
                aria-label="Time left"
              >
                <ClockIcon weight="bold" className="size-3.5" />
                {clock(remaining)}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={submit}
              disabled={submitting}
            >
              {practice ? "Finish" : "Submit test"}
            </Button>
          </div>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 h-[3px] bg-gray-100 sm:static sm:mt-3.5 sm:h-1.5 sm:overflow-hidden sm:rounded-full"
          role="progressbar"
          aria-label="Answered"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div
            className="h-full bg-teal transition-[width] duration-500 ease-out sm:rounded-full"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Phones: the question sits on the page and the options are the surfaces. Larger screens: one card. */}
      <section
        key={current.id}
        aria-label={`Question ${state.index + 1}`}
        className="rise space-y-5 sm:rounded-2xl sm:border sm:border-border sm:bg-white sm:p-7 sm:shadow-[0_1px_2px_rgba(10,37,64,0.05)]"
      >
        {result && (
          <StatusBadge status={result.isCorrect ? "correct" : "wrong"} />
        )}
        <p className="text-[17px] leading-[1.6] font-semibold text-pretty break-words whitespace-pre-line text-heading sm:text-lg sm:leading-relaxed">
          {current.questionText}
        </p>

        {result ? (
          <OptionReveal
            options={current.options}
            correctOptionId={result.correctOptionId}
            selectedOptionId={result.selectedOptionId}
          />
        ) : (
          <div
            className="space-y-2.5"
            role="radiogroup"
            aria-label={`Answers to question ${state.index + 1}`}
          >
            {current.options.map((o, i) => {
              const on = picked === o.id
              return (
                <label
                  key={o.id}
                  className={
                    "flex min-h-14 cursor-pointer touch-manipulation items-center gap-3.5 rounded-xl border bg-white px-4 py-3 text-[15px] leading-snug transition-[background-color,border-color,box-shadow,transform] duration-150 select-none active:scale-[0.985] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal has-[:focus-visible]:ring-offset-2 " +
                    (on
                      ? "border-teal bg-mint/60 text-heading shadow-[inset_0_0_0_1px_hsl(var(--teal))]"
                      : "border-border text-gray-700 shadow-[0_1px_2px_rgba(10,37,64,0.04)] hover:border-teal/50 hover:bg-gray-50")
                  }
                >
                  <input
                    type="radio"
                    name={current.id}
                    className="sr-only"
                    checked={on}
                    onChange={() => pick(o.id)}
                    disabled={submitting || state.checking}
                  />
                  <Letter i={i} on={on} />
                  <span
                    className={
                      "min-w-0 flex-1 break-words whitespace-pre-line " +
                      (on ? "font-medium" : "")
                    }
                  >
                    {o.optionText}
                  </span>
                </label>
              )
            })}
          </div>
        )}

        {result && (
          <Feedback
            ref={feedbackRef}
            answer={result}
            options={current.options}
          />
        )}
      </section>

      <ErrorNote error={state.error} />

      {/* Phones: the controls stay in thumb reach at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2.5 border-t border-border/70 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button
          variant="outline"
          size="lg"
          className="size-12 shrink-0 px-0 sm:h-10 sm:w-auto sm:px-5 sm:text-sm"
          onClick={() => go(state.index - 1)}
          disabled={state.index === 0}
          aria-label="Previous question"
        >
          <ArrowLeftIcon /> <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex flex-1 gap-2 sm:flex-none">
          {practice && !result && (
            <Button
              variant="ghost"
              size="lg"
              className="shrink-0 px-4 sm:h-10 sm:text-sm"
              onClick={() => (last ? submit() : go(state.index + 1))}
              disabled={submitting || state.checking}
            >
              {last ? "Finish" : "Skip"}
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1 sm:h-10 sm:flex-none sm:px-5 sm:text-sm"
            onClick={primary}
            disabled={
              submitting || state.checking || (practice && !result && !picked)
            }
          >
            {(submitting || state.checking) && (
              <CircleNotchIcon className="animate-spin" />
            )}
            {practice && !result
              ? "Check answer"
              : last
                ? practice
                  ? "Finish & review"
                  : "Submit test"
                : "Next"}
            {!last && !(practice && !result) && <ArrowRightIcon />}
          </Button>
        </div>
      </div>

      {/* Room for the fixed bar on phones so the last option never hides under it. */}
      <div aria-hidden className="h-16 sm:hidden" />

      <nav
        aria-label="All questions"
        className="hidden space-y-4 rounded-2xl border border-border bg-white p-5 sm:block"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span className="text-sm font-semibold text-heading">
            All questions
          </span>
          <QuestionLegend />
        </div>
        <QuestionNumbers />
      </nav>

      {/* Phones: every question, and the way out, in a bottom sheet opened from the status bar. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] gap-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div
            aria-hidden
            className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-gray-200"
          />
          <SheetHeader className="px-5 pt-3 pb-4">
            <SheetTitle className="text-base font-semibold text-heading">
              All questions
            </SheetTitle>
            <SheetDescription className="tnum">
              {done} of {total} {practice ? "checked" : "answered"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 overflow-y-auto px-5 pb-5">
            <QuestionLegend />
            <QuestionNumbers onPick={() => setNavOpen(false)} />
          </div>
          <div className="border-t border-border px-5 pt-4">
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => {
                setNavOpen(false)
                submit()
              }}
              disabled={submitting}
            >
              {practice ? "Finish & review" : "Submit test"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function clock(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`
}

function QuestionLegend() {
  const { practice } = useQuizSession()
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
      {practice ? (
        <>
          <Legend className="border-green-600/30 bg-lime-soft">Right</Legend>
          <Legend className="border-red-200 bg-red-50">Wrong</Legend>
        </>
      ) : (
        <Legend className="border-teal bg-teal">Answered</Legend>
      )}
      <Legend className="border-gray-300 bg-white">Not answered</Legend>
    </span>
  )
}

/** Jump to any question; shows which are answered (mock) or right/wrong (practice). */
function QuestionNumbers({ onPick }: { onPick?: () => void }) {
  const { questions, practice, state, go } = useQuizSession()
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
      {questions.map((q, i) => {
        const checked = state.checked[q.id]
        const answered = practice ? !!checked : !!state.picked[q.id]
        const tone = practice
          ? checked
            ? checked.isCorrect
              ? "border-green-600/30 bg-lime-soft text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
            : "border-gray-200 bg-white text-gray-600 hover:border-teal/50"
          : answered
            ? "border-teal bg-teal text-white"
            : "border-gray-200 bg-white text-gray-600 hover:border-teal/50"
        const here = i === state.index
        return (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => {
                go(i)
                onPick?.()
              }}
              aria-current={here ? "step" : undefined}
              aria-label={`Question ${i + 1}, ${practice && checked ? (checked.isCorrect ? "right" : "wrong") : answered ? "answered" : "not answered"}`}
              className={
                "tnum grid h-11 w-full touch-manipulation place-items-center rounded-lg border text-sm font-semibold transition-colors active:scale-95 sm:size-9 sm:rounded-md sm:text-xs " +
                tone +
                (here ? " ring-2 ring-heading ring-offset-2" : "")
              }
            >
              {i + 1}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Legend({
  className,
  children,
}: {
  className: string
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={"size-3 rounded-[3px] border " + className} />
      {children}
    </span>
  )
}

function Letter({
  i,
  on,
  className = "",
}: {
  i: number
  on?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={
        "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors duration-150 " +
        // A className (the reveal's green/red) replaces the default colours rather than fighting them.
        (className ||
          (on
            ? "border-teal bg-teal text-white"
            : "border-gray-300 bg-white text-gray-500"))
      }
    >
      {LETTERS[i]}
    </span>
  )
}

/** Practice: right or wrong, the right option if missed, and why. */
function Feedback({
  answer,
  options,
  ref,
}: {
  answer: AttemptAnswer
  options: Question["options"]
  ref?: React.Ref<HTMLDivElement>
}) {
  const correct = options.findIndex((o) => o.id === answer.correctOptionId)
  return (
    <div
      ref={ref}
      role="status"
      className={
        // Scroll margins clear the pinned status bar above and, on phones, the fixed controls below.
        "rise scroll-mt-40 scroll-mb-28 space-y-1.5 rounded-xl border px-4 py-3.5 text-sm sm:scroll-mt-48 sm:scroll-mb-6 " +
        (answer.isCorrect
          ? "border-green-600/30 bg-lime-soft/50"
          : "border-red-200 bg-red-50")
      }
    >
      <p
        className={
          "flex items-center gap-2 font-semibold " +
          (answer.isCorrect ? "text-green-700" : "text-red-700")
        }
      >
        {answer.isCorrect ? (
          <CheckCircleIcon className="size-4" />
        ) : (
          <XCircleIcon className="size-4" />
        )}
        {answer.isCorrect
          ? "Correct"
          : `Not quite. The right answer is ${LETTERS[correct] ?? "marked in green"}.`}
      </p>
      {answer.explanation && (
        <p className="leading-relaxed whitespace-pre-line text-gray-700">
          {answer.explanation}
        </p>
      )}
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
    <ul className="space-y-2.5 text-[15px] leading-snug">
      {options.map((o, i) => {
        const correct = o.id === correctOptionId
        const wrongPick = !correct && o.id === selectedOptionId
        return (
          <li
            key={o.id}
            className={
              "flex min-h-14 items-center gap-3.5 rounded-xl border px-4 py-3 " +
              (correct
                ? "border-green-600/30 bg-lime-soft/60 font-medium text-green-700"
                : wrongPick
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-border text-gray-500")
            }
          >
            <Letter
              i={i}
              className={
                correct
                  ? "border-green-600 bg-green-600 text-white"
                  : wrongPick
                    ? "border-red-600 bg-red-600 text-white"
                    : ""
              }
            />
            <span className="min-w-0 flex-1 break-words whitespace-pre-line">
              {o.optionText}
            </span>
            {o.id === selectedOptionId && (
              <span className="shrink-0 text-xs font-semibold">
                Your answer
              </span>
            )}
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
function MockScore({
  result,
  onRestart,
  onExit,
}: {
  result: MockResult
  onRestart: () => void
  onExit: () => void
}) {
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
            <Badge
              variant={result.passed ? "lime" : "secondary"}
              className="h-7 px-3 text-xs"
            >
              {result.passed ? "Passed" : "Not passed"}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="tnum flex justify-between text-sm text-white/80">
              <span>{pct}%</span>
              <span>Pass mark {result.passPercent}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-secondary transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
              <div
                aria-hidden
                className="absolute -inset-y-1 w-0.5 rounded-full bg-white"
                style={{ left: `${result.passPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <p className="text-sm text-gray-600">
        Mock test answers stay hidden, like in the real exam. Revise the lesson
        and try again to improve your score.
      </p>
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
export function PracticeReview({
  quiz,
  answers,
  actions,
}: {
  quiz: Quiz
  answers: AttemptAnswer[]
  actions?: React.ReactNode
}) {
  const [filter, setFilter] = useState<ReviewStatus | "all">("all")
  const byQ = new Map(answers.map((a) => [a.questionId, a]))
  const rows = (quiz.questions ?? []).map((q, i) => {
    const a = byQ.get(q.id)
    const status: ReviewStatus = !a
      ? "skipped"
      : a.isCorrect
        ? "correct"
        : "wrong"
    return { q, i, a, status }
  })
  const count = (s: ReviewStatus) => rows.filter((r) => r.status === s).length
  const shown =
    filter === "all" ? rows : rows.filter((r) => r.status === filter)
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
              <span className="text-2xl text-white/60">
                {" "}
                of {rows.length} right
              </span>
            </div>
          </div>
          <div className="tnum flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <CheckCircleIcon className="size-4 text-secondary" />{" "}
              {count("correct")} correct
            </span>
            <span className="flex items-center gap-1.5">
              <XCircleIcon className="size-4 text-red-300" /> {count("wrong")}{" "}
              wrong
            </span>
            <span className="flex items-center gap-1.5">
              <MinusCircleIcon className="size-4 text-white/50" />{" "}
              {count("skipped")} skipped
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
              (filter === f.key
                ? "border-teal bg-teal text-white"
                : "border-border bg-white text-gray-600 hover:border-teal/40")
            }
          >
            {f.label} · {f.n}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="text-sm text-gray-500">
          No {filter} questions in this session.
        </p>
      )}

      {shown.map(({ q, i, a, status }, k) => (
        <Card
          key={q.id}
          className="rise bg-white"
          style={{ "--i": Math.min(k, 8) } as React.CSSProperties}
        >
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-teal">
                Question {i + 1}
              </span>
              <StatusBadge status={status} />
            </div>
            <p className="text-base leading-snug font-semibold whitespace-pre-line text-heading">
              {q.questionText}
            </p>
            {a ? (
              <>
                <OptionReveal
                  options={q.options}
                  correctOptionId={a.correctOptionId}
                  selectedOptionId={a.selectedOptionId}
                />
                {a.explanation && (
                  <div className="rounded-md bg-mint/70 px-4 py-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-teal">
                      Explanation
                    </p>
                    <p className="leading-relaxed whitespace-pre-line text-gray-700">
                      {a.explanation}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <OptionReveal options={q.options} />
                <p className="text-xs text-gray-500">
                  You skipped this one. Answer it next practice to see the
                  explanation.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
