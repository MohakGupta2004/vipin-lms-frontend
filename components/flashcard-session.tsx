"use client"

import { createContext, use, useCallback, useMemo, useReducer, useRef } from "react"

import { errMsg } from "@/components/app-shell"
import { reviewFlashcard, type Flashcard, type FlashcardRating } from "@/lib/api"

/**
 * One run through a shuffled set of cards, one at a time: flip, rate 1–5, next. The server already
 * returned the cards in a random order without repeats, so the session just walks the list.
 */
type Status = "studying" | "finished"

type State = {
  index: number
  flipped: boolean
  rating: boolean
  /** cardId -> rating given in this session */
  ratings: Record<string, FlashcardRating>
  status: Status
  error: string | null
}

type Action =
  | { type: "flip" }
  | { type: "rating" }
  | { type: "rated"; cardId: string; rating: FlashcardRating; last: boolean }
  | { type: "next"; last: boolean }
  | { type: "failed"; error: string }

const initial: State = { index: 0, flipped: false, rating: false, ratings: {}, status: "studying", error: null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "flip":
      return state.status === "studying" ? { ...state, flipped: !state.flipped, error: null } : state
    case "rating":
      return { ...state, rating: true, error: null }
    case "rated":
      return {
        ...state,
        rating: false,
        ratings: { ...state.ratings, [action.cardId]: action.rating },
        ...advance(state, action.last),
      }
    case "next":
      return { ...state, ...advance(state, action.last) }
    case "failed":
      return { ...state, rating: false, error: action.error }
  }
}

function advance(state: State, last: boolean): Pick<State, "index" | "flipped" | "status"> {
  return last
    ? { index: state.index, flipped: false, status: "finished" }
    : { index: state.index + 1, flipped: false, status: "studying" }
}

type FlashcardSession = {
  cards: Flashcard[]
  /** Students rate cards; an instructor looking through their own deck only flips and moves on. */
  canRate: boolean
  state: State
  current: Flashcard
  flip: () => void
  /** Saves the rating, then moves to the next card (or the end). */
  rate: (rating: FlashcardRating) => Promise<void>
  /** Moves on without a rating. */
  next: () => void
}

const FlashcardSessionContext = createContext<FlashcardSession | null>(null)

export function useFlashcardSession() {
  const session = use(FlashcardSessionContext)
  if (!session) throw new Error("useFlashcardSession must be used inside <FlashcardSessionProvider>")
  return session
}

export function FlashcardSessionProvider({
  cards,
  canRate,
  children,
}: {
  cards: Flashcard[]
  canRate: boolean
  children: React.ReactNode
}) {
  const [state, dispatch] = useReducer(reducer, initial)
  const current = cards[state.index]
  const busy = useRef(false)
  const last = state.index === cards.length - 1

  const flip = useCallback(() => dispatch({ type: "flip" }), [])

  const rate = useCallback(
    async (rating: FlashcardRating) => {
      if (!canRate || !state.flipped || state.status !== "studying" || busy.current) return
      busy.current = true
      dispatch({ type: "rating" })
      try {
        await reviewFlashcard(current.id, rating)
        dispatch({ type: "rated", cardId: current.id, rating, last })
      } catch (e) {
        dispatch({ type: "failed", error: errMsg(e) })
      } finally {
        busy.current = false
      }
    },
    [canRate, current, last, state.flipped, state.status]
  )

  const next = useCallback(() => dispatch({ type: "next", last }), [last])

  const value = useMemo<FlashcardSession>(
    () => ({ cards, canRate, state, current, flip, rate, next }),
    [cards, canRate, state, current, flip, rate, next]
  )

  return <FlashcardSessionContext value={value}>{children}</FlashcardSessionContext>
}
