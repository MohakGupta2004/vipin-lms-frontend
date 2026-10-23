"use client"

import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  ClockIcon,
  MinusCircleIcon,
  PaperPlaneTiltIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import { useEffect, useRef, useState } from "react"

import { ErrorNote } from "@/components/app-shell"
import { cn } from "@/lib/utils"
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
import type { AttemptAnswer, Question, Quiz } from "@/lib/api"

const LETTERS = "ABCDEFGHIJ"

/** The test in progress, then the mock score with its answers, or the practice review. Must sit inside <QuizSessionProvider>. */
export function QuizPlayer({
  onRestart,
  onExit,
  exitLabel = "Practice section",
}: {
  onRestart: () => void
  onExit: () => void
  exitLabel?: string
}) {
  const { quiz, practice, state } = useQuizSession()
  if (state.status !== "finished") return <Runner />
  if (!practice && state.mockResult) {
    const r = state.mockResult
    return (
      <MockReview
        quiz={quiz}
        score={r.score}
        total={r.total}
        passed={r.passed}
        passPercent={r.passPercent}
        answers={r.answers ?? []}
        actions={
          <>
            <Button onClick={onRestart}>
              <ArrowCounterClockwiseIcon /> Retake test
            </Button>
            <Button variant="outline" onClick={onExit}>
              {exitLabel}
            </Button>
          </>
        }
      />
    )
  }
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
            {exitLabel}
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
    unpick,
    check,
    retry,
    reveal,
    finish,
  } = useQuizSession()
  const total = questions.length
  const last = state.index === total - 1
  const picked = state.picked[current.id]
  const result = practice ? state.checked[current.id] : undefined
  const submitting = state.status === "submitting"
  // A wrong answer keeps the correct option hidden until the student asks, so they can try again.
  const showAnswer = !!result && (result.isCorrect || !!state.revealed[current.id])
  const canRetry = !!result && !showAnswer && !submitting
  const optionsRef = useRef<HTMLDivElement>(null)

  // Try again, optionally straight onto another option (tapping it in the revealed list).
  function tryAgain(optionId?: string) {
    retry()
    if (optionId) pick(optionId)
    requestAnimationFrame(() => optionsRef.current?.querySelector<HTMLInputElement>(optionId ? "input:checked" : "input")?.focus({ preventScroll: true }))
  }

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
      } else if (e.key.toLowerCase() === "r" && canRetry) {
        tryAgain()
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
      <div className="material sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 -mt-3 bg-background/85 px-4 pt-2 pb-3 backdrop-blur-xl backdrop-saturate-150 sm:mx-0 sm:mt-0 sm:bg-white/95 sm:rounded-2xl sm:border sm:border-border sm:px-5 sm:py-4 sm:shadow-[0_2px_12px_-4px_rgba(10,37,64,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-muted-foreground sm:hidden">
              {quiz.title}
            </p>
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="-mx-1.5 flex min-h-9 items-center gap-1 rounded-md px-1.5 text-left transition-colors active:bg-gray-100 sm:pointer-events-none sm:mx-0 sm:min-h-0 sm:px-0"
              aria-label={`Question ${state.index + 1} of ${total}. Show all questions`}
            >
              <span className="tnum text-[17px] font-semibold tracking-[-0.01em] whitespace-nowrap text-heading sm:text-base sm:tracking-normal">
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
            className="h-full rounded-r-full bg-teal transition-[width] duration-500 ease-(--ease-out) sm:rounded-full"
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
          <span className="max-sm:hidden">
            <StatusBadge status={result.isCorrect ? "correct" : "wrong"} />
          </span>
        )}
        <QuestionText
          text={current.questionText}
          className="text-[17px] leading-[1.45] tracking-[-0.01em] sm:text-lg sm:leading-relaxed sm:tracking-normal"
        />

        {result ? (
          <OptionReveal
            options={current.options}
            correctOptionId={showAnswer ? result.correctOptionId : undefined}
            selectedOptionId={result.selectedOptionId}
            onPick={canRetry ? tryAgain : undefined}
          />
        ) : (
          <div
            ref={optionsRef}
            className={GROUP}
            role="radiogroup"
            aria-label={`Answers to question ${state.index + 1}`}
          >
            {current.options.map((o, i) => {
              const on = picked === o.id
              return (
                <label
                  key={o.id}
                  className={cn(
                    ROW,
                    "cursor-pointer touch-manipulation select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal has-[:focus-visible]:ring-inset sm:has-[:focus-visible]:ring-offset-2 sm:has-[:focus-visible]:ring-inset-0",
                    on
                      ? "text-heading max-sm:bg-teal/[0.06] sm:border-teal sm:bg-mint/60 sm:shadow-[inset_0_0_0_1px_hsl(var(--teal))]"
                      : "text-gray-800 max-sm:active:bg-gray-100 sm:border-border sm:text-gray-700 sm:shadow-[0_1px_2px_rgba(10,37,64,0.04)] sm:hover:border-teal/50 sm:hover:bg-gray-50 sm:active:scale-[0.985]"
                  )}
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
                  <span className={cn("min-w-0 flex-1 break-words whitespace-pre-line", on && "font-medium")}>{o.optionText}</span>
                  {/* Phones: the iOS selection mark, trailing. */}
                  <CheckIcon
                    weight="bold"
                    aria-hidden
                    className={cn("size-[18px] shrink-0 text-teal transition-[opacity,transform] duration-200 ease-(--ease-out) sm:hidden", on ? "scale-100 opacity-100" : "scale-50 opacity-0")}
                  />
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
            showAnswer={showAnswer}
            onRetry={() => tryAgain()}
            onReveal={reveal}
          />
        )}
      </section>

      <ErrorNote error={state.error} />

      {/* Phones: the controls stay in thumb reach at the bottom of the screen. */}
      <div className="material fixed inset-x-0 bottom-0 z-30 flex items-center gap-2.5 border-t border-black/[0.06] bg-white/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150 sm:static sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button
          variant="outline"
          size="lg"
          className="size-[50px] shrink-0 rounded-full border-0 bg-gray-100 px-0 hover:bg-gray-200 disabled:opacity-40 sm:h-10 sm:w-auto sm:rounded-md sm:border sm:bg-white sm:px-5 sm:text-sm"
          onClick={() => go(state.index - 1)}
          disabled={state.index === 0}
          aria-label="Previous question"
        >
          <ArrowLeftIcon /> <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex flex-1 gap-2 sm:flex-none">
          {/* Practice: skip instead of checking. Mock: leave the question unanswered and move on. */}
          {(!practice || !result) && (
            <Button
              variant="ghost"
              size="lg"
              className="h-[50px] shrink-0 rounded-full px-4 text-[17px] font-medium text-teal hover:bg-teal/10 sm:h-10 sm:rounded-md sm:text-sm sm:text-heading"
              onClick={() => {
                if (!practice) unpick()
                if (last) submit()
                else go(state.index + 1)
              }}
              disabled={submitting || state.checking}
            >
              {last ? (practice ? "Finish" : "Skip & submit") : "Skip"}
            </Button>
          )}
          <Button
            size="lg"
            className="h-[50px] flex-1 rounded-[14px] text-[17px] disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-100 sm:h-10 sm:flex-none sm:rounded-md sm:px-5 sm:text-sm"
            onClick={primary}
            disabled={
              submitting ||
              state.checking ||
              (!picked && (practice ? !result : !last))
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
      <div aria-hidden className="h-20 sm:hidden" />

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
            : "border-transparent bg-gray-100 text-gray-500 sm:border-gray-300 sm:bg-white"))
      }
    >
      {LETTERS[i]}
    </span>
  )
}

/**
 * The stem in semibold; any lines after it (I/II/III statements, a table of facts) in regular weight,
 * each on its own line, so a long multi-statement question scans instead of reading as one bold block.
 */
function QuestionText({
  text,
  className,
}: {
  text: string
  className: string
}) {
  const [stem, ...rest] = text.trim().split("\n")
  const lines = rest.filter((l) => l.trim())
  return (
    <div
      className={
        "space-y-2.5 text-pretty break-words text-heading " + className
      }
    >
      <p className="font-semibold tracking-[-0.005em]">{stem}</p>
      {lines.length > 0 && (
        <ul className="space-y-1.5 text-[0.9375em] text-gray-700">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Practice: right or wrong, the right option if missed, and why. */
function Feedback({
  answer,
  options,
  showAnswer,
  onRetry,
  onReveal,
  ref,
}: {
  answer: AttemptAnswer
  options: Question["options"]
  showAnswer: boolean
  onRetry: () => void
  onReveal: () => void
  ref?: React.Ref<HTMLDivElement>
}) {
  const correct = options.findIndex((o) => o.id === answer.correctOptionId)
  return (
    <div
      ref={ref}
      role="status"
      className={
        // Scroll margins clear the pinned status bar above and, on phones, the fixed controls below.
        "rise scroll-mt-40 scroll-mb-28 space-y-2 rounded-2xl px-4 py-4 text-[15px] sm:scroll-mt-48 sm:scroll-mb-6 sm:rounded-xl sm:border sm:text-sm " +
        "max-sm:bg-white max-sm:shadow-[0_1px_2px_rgba(16,42,67,0.04)] " +
        (answer.isCorrect
          ? "sm:border-green-600/30 sm:bg-lime-soft/50"
          : "sm:border-red-200 sm:bg-red-50")
      }
    >
      <p
        className={
          "flex items-start gap-2 text-[17px] leading-snug font-semibold tracking-[-0.01em] sm:text-sm sm:tracking-normal " +
          (answer.isCorrect ? "text-green-700" : "text-red-600 sm:text-red-700")
        }
      >
        {answer.isCorrect ? (
          <CheckCircleIcon weight="fill" className="mt-px size-[18px] shrink-0" />
        ) : (
          <XCircleIcon weight="fill" className="mt-px size-[18px] shrink-0" />
        )}
        {answer.isCorrect
          ? "Correct"
          : showAnswer
            ? `Not quite. The answer is ${LETTERS[correct] ?? "marked in green"}.`
            : "Not quite"}
      </p>
      {!answer.isCorrect && !showAnswer && (
        <p className="text-[15px] leading-snug text-muted-foreground sm:hidden">Pick another option to try again, or see the answer.</p>
      )}
      {!answer.isCorrect && !showAnswer && (
        <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:pt-1">
          <Button className="h-11 w-full rounded-full border-0 bg-teal/10 text-[15px] text-teal hover:bg-teal/15 sm:h-9 sm:w-auto sm:rounded-md sm:bg-navy sm:text-sm sm:text-white sm:hover:bg-[#1b3b5a]" onClick={onRetry}>
            <ArrowCounterClockwiseIcon /> Try again
            <kbd className="ml-1 hidden rounded border border-white/40 px-1 text-[10px] sm:inline">R</kbd>
          </Button>
          <Button variant="outline" className="h-11 w-full rounded-full border-0 bg-gray-100 text-[15px] hover:bg-gray-200 sm:h-9 sm:w-auto sm:rounded-md sm:border sm:border-heading/30 sm:bg-white sm:text-sm" onClick={onReveal}>
            Show answer
          </Button>
        </div>
      )}
      {showAnswer && answer.explanation && (
        <p className="text-[15px] leading-[1.55] whitespace-pre-line text-gray-700 sm:text-sm">
          {answer.explanation}
        </p>
      )}
    </div>
  )
}

/**
 * Options with the correct one in green and a wrong pick in red. With onPick (a wrong practice answer still
 * hidden), every other option stays tappable and picks itself for another try.
 */
function OptionReveal({
  options,
  correctOptionId,
  selectedOptionId,
  onPick,
}: {
  options: Question["options"]
  correctOptionId?: string
  selectedOptionId?: string | null
  onPick?: (optionId: string) => void
}) {
  return (
    <ul className={GROUP}>
      {options.map((o, i) => {
        const correct = o.id === correctOptionId
        const wrongPick = !correct && o.id === selectedOptionId
        const retryable = !!onPick && !wrongPick
        return (
          <li
            key={o.id}
            onClick={retryable ? () => onPick(o.id) : undefined}
            className={cn(
              ROW,
              retryable &&
                "cursor-pointer touch-manipulation select-none max-sm:active:bg-gray-100 sm:bg-white sm:text-gray-700 sm:hover:border-teal/50 sm:hover:bg-gray-50 sm:active:scale-[0.985]",
              correct
                ? "font-medium text-heading max-sm:bg-green-600/[0.07] sm:border-green-600/40 sm:bg-[#e9f6ee] sm:text-green-800"
                : wrongPick
                  ? "text-heading max-sm:bg-red-600/[0.06] sm:border-red-300 sm:bg-[#fdeeee] sm:text-red-700"
                  : "text-gray-500 sm:border-border"
            )}
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
              {o.id === selectedOptionId && (
                <span className={cn("mt-1 block text-[12px] font-medium", correct ? "text-green-700" : wrongPick ? "text-red-600" : "text-muted-foreground")}>
                  Your answer
                </span>
              )}
            </span>
            {correct && <CheckCircleIcon weight="fill" aria-label="Correct" className="size-[22px] shrink-0 text-green-600 sm:hidden" />}
            {wrongPick && <XCircleIcon weight="fill" aria-label="Wrong" className="size-[22px] shrink-0 text-red-500 sm:hidden" />}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Answer list. Phones: one inset grouped list (white, rounded, hairline separators), like an iOS settings
 * group. Larger screens: separate outlined cards.
 */
const GROUP =
  "text-[16px] leading-[1.4] max-sm:divide-y max-sm:divide-black/[0.06] max-sm:overflow-hidden max-sm:rounded-[14px] max-sm:bg-white max-sm:shadow-[0_1px_2px_rgba(16,42,67,0.04)] sm:space-y-2.5 sm:text-[15px]"
const ROW =
  "flex min-h-[3.25rem] items-center gap-3 px-4 py-3 transition-[background-color,border-color,box-shadow,transform] duration-150 ease-(--ease-out) sm:min-h-14 sm:gap-3.5 sm:rounded-xl sm:border sm:bg-white"

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

type ReviewRow = {
  q: Question
  i: number
  a: AttemptAnswer | undefined
  status: ReviewStatus
}

/** Every question of the quiz with its graded answer, if any. Picking nothing (or leaving it out) counts as skipped. */
function reviewRows(quiz: Quiz, answers: AttemptAnswer[]): ReviewRow[] {
  const byQ = new Map(answers.map((a) => [a.questionId, a]))
  return (quiz.questions ?? []).map((q, i) => {
    const a = byQ.get(q.id)
    const status: ReviewStatus = !a?.selectedOptionId
      ? "skipped"
      : a.isCorrect
        ? "correct"
        : "wrong"
    return { q, i, a, status }
  })
}

function countRows(rows: ReviewRow[]) {
  const n = (s: ReviewStatus) => rows.filter((r) => r.status === s).length
  return { correct: n("correct"), wrong: n("wrong"), skipped: n("skipped") }
}

/** The correct / wrong / skipped tally, for the dark result cards. */
function Tally({ counts }: { counts: ReturnType<typeof countRows> }) {
  return (
    <div className="tnum flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
      <span className="flex items-center gap-1.5">
        <CheckCircleIcon className="size-4 text-secondary" /> {counts.correct}{" "}
        correct
      </span>
      <span className="flex items-center gap-1.5">
        <XCircleIcon className="size-4 text-red-300" /> {counts.wrong} wrong
      </span>
      <span className="flex items-center gap-1.5">
        <MinusCircleIcon className="size-4 text-white/50" /> {counts.skipped}{" "}
        skipped
      </span>
    </div>
  )
}

/**
 * A finished mock test: the marks, how many were right, wrong and skipped, then every question with
 * the student's answer, the correct one and the explanation.
 */
export function MockReview({
  quiz,
  score,
  total,
  passed,
  passPercent,
  answers,
  actions,
}: {
  quiz: Quiz
  score: number
  total: number
  passed: boolean
  passPercent: number
  answers: AttemptAnswer[]
  actions?: React.ReactNode
}) {
  const rows = reviewRows(quiz, answers)
  const counts = countRows(rows)
  const pct = total ? Math.round((score / total) * 100) : 0
  return (
    <div className="space-y-4">
      <Card className="pop overflow-hidden bg-navy">
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-white/75">Your score</div>
              <div className="tnum text-5xl font-semibold text-white sm:text-6xl">
                {score}
                <span className="text-2xl text-white/60 sm:text-3xl">
                  /{total}
                </span>
              </div>
            </div>
            <Badge
              variant={passed ? "lime" : "secondary"}
              className="h-7 px-3 text-xs"
            >
              {passed ? "Passed" : "Not passed"}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="tnum flex justify-between text-sm text-white/80">
              <span>{pct}%</span>
              <span>Pass mark {passPercent}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-secondary transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
              <div
                aria-hidden
                className="absolute -inset-y-1 w-0.5 rounded-full bg-white"
                style={{ left: `${passPercent}%` }}
              />
            </div>
          </div>
          {rows.length > 0 && <Tally counts={counts} />}
        </CardContent>
      </Card>

      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

      {rows.length > 0 && (
        <section aria-labelledby="mock-review-title" className="space-y-4 pt-2">
          <div className="space-y-1">
            <h2
              id="mock-review-title"
              className="text-lg font-semibold text-heading"
            >
              Answers and explanations
            </h2>
            <p className="text-sm text-gray-600">
              See where you went wrong, then retake the test to improve your
              score.
            </p>
          </div>
          <ReviewList rows={rows} mock />
        </section>
      )}
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
  const rows = reviewRows(quiz, answers)
  const counts = countRows(rows)

  return (
    <div className="space-y-4">
      <Card className="pop overflow-hidden bg-navy">
        <CardContent className="space-y-5">
          <div className="space-y-1">
            <div className="text-sm text-white/75">Practice review</div>
            <div className="tnum text-5xl font-semibold text-white">
              {counts.correct}
              <span className="text-2xl text-white/60">
                {" "}
                of {rows.length} right
              </span>
            </div>
          </div>
          <Tally counts={counts} />
        </CardContent>
      </Card>

      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

      <ReviewList rows={rows} />
    </div>
  )
}

/**
 * Filter chips and one card per question. In a mock test every question is graded, so a skipped one still
 * shows the correct answer and explanation; in practice a skipped question was never checked and stays hidden.
 */
function ReviewList({ rows, mock = false }: { rows: ReviewRow[]; mock?: boolean }) {
  const [filter, setFilter] = useState<ReviewStatus | "all">("all")
  const counts = countRows(rows)
  const shown =
    filter === "all" ? rows : rows.filter((r) => r.status === filter)
  const filters: { key: ReviewStatus | "all"; label: string; n: number }[] = [
    { key: "all", label: "All", n: rows.length },
    { key: "wrong", label: "Wrong", n: counts.wrong },
    { key: "correct", label: "Correct", n: counts.correct },
    { key: "skipped", label: "Skipped", n: counts.skipped },
  ]

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Show questions">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={
              "tnum min-h-9 touch-manipulation rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
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
          No {filter} questions in this {mock ? "test" : "session"}.
        </p>
      )}

      {shown.map(({ q, i, a, status }, k) => (
        <Card
          key={q.id}
          className="rise bg-white max-sm:[--card-spacing:--spacing(4)]"
          style={{ "--i": Math.min(k, 8) } as React.CSSProperties}
        >
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-teal">
                Question {i + 1}
              </span>
              <StatusBadge status={status} />
            </div>
            <QuestionText
              text={q.questionText}
              className="text-base leading-[1.55]"
            />
            {a ? (
              <>
                <OptionReveal
                  options={q.options}
                  correctOptionId={a.correctOptionId}
                  selectedOptionId={a.selectedOptionId}
                />
                {status === "skipped" && (
                  <p className="text-xs text-gray-500">
                    You skipped this one. The correct answer is marked in
                    green.
                  </p>
                )}
                {a.explanation && (
                  <div className="rounded-md bg-mint/70 px-4 py-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-teal">
                      Explanation
                    </p>
                    <p className="leading-relaxed break-words whitespace-pre-line text-gray-700">
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
    </>
  )
}
