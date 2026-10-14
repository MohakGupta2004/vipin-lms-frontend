"use client"

import { ArrowCounterClockwiseIcon, ArrowRightIcon, CircleNotchIcon } from "@phosphor-icons/react/dist/ssr"
import { useEffect } from "react"

import { ErrorNote } from "@/components/app-shell"
import { useFlashcardSession } from "@/components/flashcard-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RATING_LABEL, type FlashcardRating } from "@/lib/api"

const RATINGS: FlashcardRating[] = [1, 2, 3, 4, 5]

/** The cards in progress, then the end screen. Must sit inside <FlashcardSessionProvider>. */
export function FlashcardPlayer({ onRestart, onExit }: { onRestart: () => void; onExit: () => void }) {
  const { state } = useFlashcardSession()
  return state.status === "finished" ? <Finished onRestart={onRestart} onExit={onExit} /> : <Runner />
}

function Runner() {
  const { cards, canRate, state, current, flip, rate, next } = useFlashcardSession()
  const total = cards.length
  const rated = Object.keys(state.ratings).length
  const last = state.index === total - 1

  // Space / Enter flip, 1–5 rate, → moves on when ratings are off.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest("textarea, select, [contenteditable], input")) return
      if ((e.key === " " || e.key === "Enter") && el.tagName !== "BUTTON") {
        flip()
      } else if (/^[1-5]$/.test(e.key) && canRate && state.flipped) {
        void rate(Number(e.key) as FlashcardRating)
      } else if (e.key === "ArrowRight" && !canRate && el.tagName !== "BUTTON") {
        next()
      } else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="space-y-4">
      <div className="sticky top-[88px] z-20 space-y-3 rounded-lg border border-border bg-white/95 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="tnum text-base font-semibold text-heading">
            Card {state.index + 1} <span className="font-normal text-gray-500">of {total}</span>
          </span>
          <span className="tnum text-sm text-gray-500">{total - state.index - 1} left</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-teal transition-[width] duration-500 ease-out"
            style={{ width: `${total ? ((canRate ? rated : state.index) / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div key={current.id} className="rise">
        <button
            type="button"
            onClick={flip}
            aria-label={state.flipped ? "Showing the answer. Flip back to the question" : "Showing the question. Flip to see the answer"}
            className="flip block w-full cursor-pointer rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flip-inner" data-flipped={state.flipped}>
              <Face label="Question" text={current.front} hidden={state.flipped} hint="Tap or press Space to flip" />
              <Face label="Answer" text={current.back} hidden={!state.flipped} back />
            </span>
        </button>
      </div>

      <ErrorNote error={state.error} />

      {canRate ? (
        <div className="space-y-2" aria-hidden={!state.flipped}>
          <p className="text-center text-sm text-gray-500">
            {state.flipped ? "How well did you know it?" : "Flip the card to rate yourself"}
          </p>
          <div className="grid grid-cols-5 gap-2" role="group" aria-label="Rate how well you knew this card">
            {RATINGS.map((r) => (
              <Button
                key={r}
                variant="outline"
                disabled={!state.flipped || state.rating}
                onClick={() => void rate(r)}
                className="h-auto flex-col gap-0.5 py-2.5"
                aria-label={`${r}, ${RATING_LABEL[r]}`}
              >
                <span className="tnum text-base font-semibold">{r}</span>
                <span className="text-[11px] font-normal text-gray-500 max-sm:hidden">{RATING_LABEL[r]}</span>
              </Button>
            ))}
          </div>
          {state.rating && (
            <p className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <CircleNotchIcon className="size-3.5 animate-spin" /> Saving…
            </p>
          )}
        </div>
      ) : (
        <div className="flex justify-end">
          <Button onClick={next}>
            {last ? "Finish" : "Next"} {!last && <ArrowRightIcon />}
          </Button>
        </div>
      )}
    </div>
  )
}

function Face({ label, text, hidden, hint, back }: { label: string; text: string; hidden: boolean; hint?: string; back?: boolean }) {
  return (
    <span
      aria-hidden={hidden}
      className={"flip-face flex min-h-56 flex-col justify-between gap-6 rounded-lg border p-6 sm:p-8 " + (back ? "flip-back border-teal/30 bg-mint/60" : "border-border bg-white")}
    >
      <span className="text-xs font-medium text-teal">{label}</span>
      <span className="block text-xl leading-snug font-semibold whitespace-pre-line text-heading sm:text-2xl">{text}</span>
      <span className="text-xs text-gray-400">{hint ?? " "}</span>
    </span>
  )
}

function Finished({ onRestart, onExit }: { onRestart: () => void; onExit: () => void }) {
  const { cards, canRate, state } = useFlashcardSession()
  const counts = RATINGS.map((r) => Object.values(state.ratings).filter((x) => x === r).length)
  const rated = counts.reduce((a, b) => a + b, 0)
  const max = Math.max(1, ...counts)
  const strong = counts[3] + counts[4]

  return (
    <div className="space-y-4">
      <Card className="pop overflow-hidden bg-navy">
        <CardContent className="space-y-5">
          <div className="space-y-1">
            <div className="text-sm text-white/75">Session complete</div>
            <div className="tnum text-5xl font-semibold text-white">
              {cards.length}
              <span className="text-2xl text-white/60"> {cards.length === 1 ? "card" : "cards"} studied</span>
            </div>
          </div>
          {canRate && rated > 0 && (
            <p className="tnum text-sm text-white/80">
              {strong} of {rated} rated 4 or 5. Cards you rate low come back more often.
            </p>
          )}
        </CardContent>
      </Card>

      {canRate && rated > 0 && (
        <Card className="bg-white">
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-heading">Your ratings</p>
            <ul className="space-y-2">
              {RATINGS.map((r, i) => (
                <li key={r} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-gray-600">
                    <span className="tnum font-semibold text-heading">{r}</span> {RATING_LABEL[r]}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span className="block h-full rounded-full bg-teal" style={{ width: `${(counts[i] / max) * 100}%` }} />
                  </span>
                  <span className="tnum w-6 text-right text-gray-500">{counts[i]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onRestart}>
          <ArrowCounterClockwiseIcon /> Study again
        </Button>
        <Button variant="outline" onClick={onExit}>
          Back
        </Button>
      </div>
    </div>
  )
}
