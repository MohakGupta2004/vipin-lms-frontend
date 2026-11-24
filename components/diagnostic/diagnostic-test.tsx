"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretDownIcon,
  CheckIcon,
  PaperPlaneTiltIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr"
import { useEffect, useState } from "react"

import { GROUP, Letter, QuestionText, ROW } from "@/components/quiz-player"
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
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DIAGNOSTIC_QUESTIONS } from "@/lib/diagnostic-questions"
import {
  CONFIDENCE_EMOJI,
  type DiagnosticAnswer,
  type DiagnosticConfidence,
} from "@/lib/diagnostic-score"
import { cn } from "@/lib/utils"

const LETTERS = "ABCDEFGHIJ"
const TOTAL = DIAGNOSTIC_QUESTIONS.length

type Rating = Exclude<DiagnosticConfidence, "none">

const RATINGS: { value: Rating; label: string }[] = [
  { value: "high", label: "Confident" },
  { value: "medium", label: "Unsure" },
  { value: "low", label: "Guessing" },
]

export function DiagnosticTest({ onSubmit }: { onSubmit: (answers: DiagnosticAnswer[]) => void }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Record<number, number>>({})
  const [confidence, setConfidence] = useState<Record<number, DiagnosticConfidence>>({})
  // The question whose confidence prompt is open, if any.
  const [asking, setAsking] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const question = DIAGNOSTIC_QUESTIONS[index]
  const last = index === TOTAL - 1
  const selected = picked[question.id]
  const answered = Object.keys(picked).length
  const left = TOTAL - answered

  function go(next: number) {
    if (next < 0 || next >= TOTAL) return
    setAsking(null)
    setIndex(next)
  }

  function choose(optionIndex: number) {
    setPicked({ ...picked, [question.id]: optionIndex })
    // Picking again resets the rating and asks again.
    setConfidence({ ...confidence, [question.id]: "none" })
    setAsking(question.id)
  }

  function rate(value: Rating) {
    if (asking === null) return
    setConfidence({ ...confidence, [asking]: value })
    setAsking(null)
  }

  function submit() {
    setAsking(null)
    setConfirming(true)
  }

  function finish() {
    const answers: DiagnosticAnswer[] = []
    for (const q of DIAGNOSTIC_QUESTIONS) {
      answers.push({
        questionId: q.id,
        picked: picked[q.id] ?? -1,
        confidence: picked[q.id] === undefined ? "none" : (confidence[q.id] ?? "none"),
      })
    }
    setConfirming(false)
    onSubmit(answers)
  }

  function primary() {
    if (last) submit()
    else go(index + 1)
  }

  // Leaving the page mid-test would lose the answers.
  useEffect(() => {
    if (answered === 0) return
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [answered])

  // 1-9 / A-J pick an option, left and right arrows move between questions.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (confirming || navOpen) return
      const target = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (target.closest("textarea, select, [contenteditable], input:not([type=radio])")) return

      const number = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : LETTERS.indexOf(e.key.toUpperCase())
      if (number >= 0 && number < question.options.length) {
        choose(number)
      } else if (e.key === "ArrowRight" && target.tagName !== "INPUT") {
        go(index + 1)
      } else if (e.key === "ArrowLeft" && target.tagName !== "INPUT") {
        go(index - 1)
      } else {
        return
      }
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="space-y-5 sm:space-y-6">
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia
              className={left > 0 ? "bg-amber-50 text-amber-600" : "bg-accent text-primary"}
            >
              {left > 0 ? (
                <WarningCircleIcon weight="duotone" />
              ) : (
                <PaperPlaneTiltIcon weight="duotone" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {left > 0 ? `Submit with ${left} unanswered?` : "Submit your test?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {left > 0
                ? "Unanswered questions score 0. You can't change your answers after you submit."
                : `You've answered all ${TOTAL} questions. You can't change your answers after you submit.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="tnum grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
            <div className="bg-white px-4 py-3">
              <dt className="text-xs text-muted-foreground">Answered</dt>
              <dd className="mt-0.5 font-medium text-heading">
                {answered} <span className="font-normal text-gray-400">of {TOTAL}</span>
              </dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-xs text-muted-foreground">Unanswered</dt>
              <dd className="mt-0.5 font-medium text-heading">{left}</dd>
            </div>
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel>{left > 0 ? "Keep answering" : "Review answers"}</AlertDialogCancel>
            <AlertDialogAction onClick={finish}>Submit test</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status bar, pinned under the app header. Phones: the progress is its bottom edge. */}
      <div className="material sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 -mt-3 bg-background/85 px-4 pt-2 pb-3 backdrop-blur-xl backdrop-saturate-150 sm:mx-0 sm:mt-0 sm:bg-white/95 sm:rounded-2xl sm:border sm:border-border sm:px-5 sm:py-4 sm:shadow-[0_2px_12px_-4px_rgba(10,37,64,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-muted-foreground sm:hidden">
              Skill diagnostic
            </p>
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="-mx-1.5 flex min-h-9 items-center gap-1 rounded-md px-1.5 text-left transition-colors active:bg-gray-100 sm:pointer-events-none sm:mx-0 sm:min-h-0 sm:px-0"
              aria-label={`Question ${index + 1} of ${TOTAL}. Show all questions`}
            >
              <span className="tnum text-[17px] font-semibold tracking-[-0.01em] whitespace-nowrap text-heading sm:text-base sm:tracking-normal">
                Question {index + 1}
                <span className="font-normal text-gray-500"> of {TOTAL}</span>
              </span>
              <CaretDownIcon weight="bold" className="size-3.5 text-gray-500 sm:hidden" />
            </button>
          </div>
          <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={submit}>
            Submit test
          </Button>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 h-[3px] bg-gray-100 sm:static sm:mt-3.5 sm:h-1.5 sm:overflow-hidden sm:rounded-full"
          role="progressbar"
          aria-label="Answered"
          aria-valuemin={0}
          aria-valuemax={TOTAL}
          aria-valuenow={answered}
        >
          <div
            className="h-full rounded-r-full bg-teal transition-[width] duration-500 ease-(--ease-out) sm:rounded-full"
            style={{ width: `${(answered / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      {/* Phones: the question sits on the page and the options are the surfaces. Larger screens: one card. */}
      <section
        key={question.id}
        aria-label={`Question ${index + 1}`}
        className="rise space-y-5 sm:rounded-2xl sm:border sm:border-border sm:bg-white sm:p-7 sm:shadow-[0_1px_2px_rgba(10,37,64,0.05)]"
      >
        <QuestionText
          text={question.question}
          className="text-[17px] leading-[1.45] tracking-[-0.01em] sm:text-lg sm:leading-relaxed sm:tracking-normal"
        />

        <div className={GROUP} role="radiogroup" aria-label={`Answers to question ${index + 1}`}>
          {question.options.map((option, optionIndex) => {
            const on = selected === optionIndex
            return (
              <label
                key={optionIndex}
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
                  name={`question-${question.id}`}
                  className="sr-only"
                  checked={on}
                  onChange={() => choose(optionIndex)}
                />
                <Letter i={optionIndex} on={on} />
                <span className={cn("min-w-0 flex-1 break-words whitespace-pre-line", on && "font-medium")}>
                  {option}
                </span>
                <CheckIcon
                  weight="bold"
                  aria-hidden
                  className={cn(
                    "size-[18px] shrink-0 text-teal transition-[opacity,transform] duration-200 ease-(--ease-out) sm:hidden",
                    on ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  )}
                />
              </label>
            )
          })}
        </div>
      </section>

      {/* Phones: the controls stay in thumb reach at the bottom of the screen. */}
      <div className="material fixed inset-x-0 bottom-0 z-30 flex items-center gap-2.5 border-t border-black/[0.06] bg-white/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150 sm:static sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button
          variant="outline"
          size="lg"
          className="size-[50px] shrink-0 rounded-full border-0 bg-gray-100 px-0 hover:bg-gray-200 disabled:opacity-40 sm:h-10 sm:w-auto sm:rounded-md sm:border sm:bg-white sm:px-5 sm:text-sm"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous question"
        >
          <ArrowLeftIcon /> <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex flex-1 gap-2 sm:flex-none">
          {selected === undefined && (
            <Button
              variant="ghost"
              size="lg"
              className="h-[50px] shrink-0 rounded-full px-4 text-[17px] font-medium text-teal hover:bg-teal/10 sm:h-10 sm:rounded-md sm:text-sm sm:text-heading"
              onClick={primary}
            >
              {last ? "Skip & submit" : "Skip"}
            </Button>
          )}
          <Button
            size="lg"
            className="h-[50px] flex-1 rounded-[14px] text-[17px] disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-100 sm:h-10 sm:flex-none sm:rounded-md sm:px-5 sm:text-sm"
            onClick={primary}
            disabled={selected === undefined && !last}
          >
            {last ? "Submit test" : "Next"}
            {!last && <ArrowRightIcon />}
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
          <span className="text-sm font-semibold text-heading">All questions</span>
          <Legend />
        </div>
        <QuestionNumbers index={index} picked={picked} onGo={go} />
      </nav>

      {asking !== null && (
        <div
          role="dialog"
          aria-label="How confident are you?"
          className="pop fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-2xl border border-border bg-white p-3 shadow-[0_18px_50px_-16px_rgba(16,42,67,0.45)] sm:bottom-8"
        >
          <div className="flex items-center justify-between gap-3 pb-2 pl-1">
            <p className="text-sm font-semibold text-heading">How confident are you?</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setAsking(null)}
              aria-label="Skip"
            >
              <XIcon />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {RATINGS.map((rating) => (
              <Button
                key={rating.value}
                type="button"
                variant="outline"
                className="h-auto flex-col gap-0.5 px-2 py-2"
                onClick={() => rate(rating.value)}
              >
                <span className="text-xl leading-none">{CONFIDENCE_EMOJI[rating.value]}</span>
                <span className="text-xs">{rating.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Phones: every question in a bottom sheet opened from the status bar. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] gap-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-gray-200" />
          <SheetHeader className="px-5 pt-3 pb-4">
            <SheetTitle className="text-base font-semibold text-heading">All questions</SheetTitle>
            <SheetDescription className="tnum">
              {answered} of {TOTAL} answered
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 overflow-y-auto px-5 pb-5">
            <Legend />
            <QuestionNumbers
              index={index}
              picked={picked}
              onGo={(next) => {
                go(next)
                setNavOpen(false)
              }}
            />
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
            >
              Submit test
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Legend() {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] border border-teal bg-teal" />
        Answered
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] border border-gray-300 bg-white" />
        Not answered
      </span>
    </span>
  )
}

function QuestionNumbers({
  index,
  picked,
  onGo,
}: {
  index: number
  picked: Record<number, number>
  onGo: (index: number) => void
}) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
      {DIAGNOSTIC_QUESTIONS.map((question, i) => {
        const answered = picked[question.id] !== undefined
        const here = i === index
        return (
          <li key={question.id}>
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-current={here ? "step" : undefined}
              aria-label={`Question ${i + 1}, ${answered ? "answered" : "not answered"}`}
              className={cn(
                "tnum grid h-11 w-full touch-manipulation place-items-center rounded-lg border text-sm font-semibold transition-colors active:scale-95 sm:size-9 sm:rounded-md sm:text-xs",
                answered
                  ? "border-teal bg-teal text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-teal/50",
                here && "ring-2 ring-heading ring-offset-2"
              )}
            >
              {i + 1}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
