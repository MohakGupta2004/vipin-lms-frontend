"use client"

import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"

import { errMsg } from "@/components/app-shell"
import { useUser } from "@/hooks/use-user"
import {
  checkAnswer,
  isPractice,
  submitAttempt,
  submitMockTest,
  type AttemptAnswer,
  type MockResult,
  type Question,
  type Quiz,
  type QuizAttempt,
} from "@/lib/api"

/**
 * One run through a test, one question at a time. Both test types share it:
 * - practice: each answer is checked on the server as soon as it is given (correct option +
 *   explanation), and the whole session is saved at the end for the review page. Progress is also
 *   kept in the browser, so a student can close the tab and carry on later, until the session is finished;
 * - mock test: answers stay editable until submit; then the marks come back with every answer explained.
 *   Nothing is kept in the browser for a mock test.
 */
type Status = "answering" | "submitting" | "finished"

type State = {
  index: number
  /** questionId -> picked optionId */
  picked: Record<string, string>
  /** Practice only: questionId -> graded answer, filled in as each one is checked. */
  checked: Record<string, AttemptAnswer>
  /** Practice only: questions whose correct answer is on show (answered right, or the student asked). */
  revealed: Record<string, true>
  checking: boolean
  status: Status
  mockResult: MockResult | null
  /** Practice only: the saved session's graded answers, set when finished. */
  review: AttemptAnswer[] | null
  error: string | null
}

type Action =
  | { type: "go"; index: number }
  | { type: "pick"; questionId: string; optionId: string }
  | { type: "retry"; questionId: string }
  | { type: "unpick"; questionId: string }
  | { type: "reveal"; questionId: string }
  | { type: "checking" }
  | { type: "checked"; answer: AttemptAnswer }
  | { type: "submitting" }
  | { type: "finished"; mockResult?: MockResult; review?: AttemptAnswer[] }
  | { type: "failed"; error: string }

const initial: State = {
  index: 0,
  picked: {},
  checked: {},
  revealed: {},
  checking: false,
  status: "answering",
  mockResult: null,
  review: null,
  error: null,
}

/** localStorage key for a student's unfinished practice run of one quiz. */
function progressKey(userId: string, quizId: string) {
  return `practice:${userId}:${quizId}`
}

type SavedProgress = {
  picked: Record<string, string>
  checked: Record<string, AttemptAnswer>
  revealed: Record<string, boolean>
}

/**
 * The practice run this student left unfinished, or null when there is none.
 * Questions the instructor has since removed are dropped.
 */
export function loadPracticeProgress(userId: string, quiz: Quiz): SavedProgress | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(progressKey(userId, quiz.id))
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<SavedProgress>
    const ids = new Set((quiz.questions ?? []).map((q) => q.id))
    const picked: Record<string, string> = {}
    const checked: Record<string, AttemptAnswer> = {}
    const revealed: Record<string, boolean> = {}
    const savedPicked = saved.picked ?? {}
    const savedChecked = saved.checked ?? {}
    const savedRevealed = saved.revealed ?? {}
    for (const questionId of Object.keys(savedPicked)) {
      if (ids.has(questionId)) picked[questionId] = savedPicked[questionId]
    }
    for (const questionId of Object.keys(savedChecked)) {
      if (ids.has(questionId)) checked[questionId] = savedChecked[questionId]
    }
    for (const questionId of Object.keys(savedRevealed)) {
      if (ids.has(questionId)) revealed[questionId] = !!savedRevealed[questionId]
    }
    // Nothing answered means nothing worth resuming.
    if (Object.keys(checked).length === 0) return null
    return { picked, checked, revealed }
  } catch {
    // Bad JSON or blocked storage: start fresh.
    return null
  }
}

export function clearPracticeProgress(userId: string, quizId: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(progressKey(userId, quizId))
  } catch {
    // Blocked storage: there is nothing to clear.
  }
}

/** The state to open a run with: a saved practice run when there is one, else a blank run. */
function startState(userId: string, quiz: Quiz, practice: boolean, questions: Question[]): State {
  if (!practice) return initial
  const saved = loadPracticeProgress(userId, quiz)
  if (!saved) return initial
  const revealed: Record<string, true> = {}
  for (const questionId of Object.keys(saved.revealed)) {
    if (saved.revealed[questionId]) revealed[questionId] = true
  }
  // Carry on at the first question without a checked answer.
  let index = questions.length - 1
  for (let i = 0; i < questions.length; i++) {
    if (!saved.checked[questions[i].id]) {
      index = i
      break
    }
  }
  if (index < 0) index = 0
  return { ...initial, picked: saved.picked, checked: saved.checked, revealed, index }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "go":
      return { ...state, index: action.index, error: null }
    case "pick":
      // A checked practice answer is final; nothing changes once the test is submitted.
      if (state.status !== "answering" || state.checking || state.checked[action.questionId]) return state
      return { ...state, picked: { ...state.picked, [action.questionId]: action.optionId } }
    case "unpick": {
      // Mock only: leave a question unanswered again.
      if (state.status !== "answering" || state.checked[action.questionId]) return state
      const picked = { ...state.picked }
      delete picked[action.questionId]
      return { ...state, picked }
    }
    case "retry": {
      // Only a wrong, still hidden answer can be retried.
      const a = state.checked[action.questionId]
      if (state.status !== "answering" || !a || a.isCorrect || state.revealed[action.questionId]) return state
      const checked = { ...state.checked }
      const picked = { ...state.picked }
      delete checked[action.questionId]
      delete picked[action.questionId]
      return { ...state, checked, picked }
    }
    case "reveal":
      if (state.status !== "answering" || !state.checked[action.questionId]) return state
      return { ...state, revealed: { ...state.revealed, [action.questionId]: true } }
    case "checking":
      return { ...state, checking: true, error: null }
    case "checked":
      return {
        ...state,
        checking: false,
        checked: { ...state.checked, [action.answer.questionId]: action.answer },
        revealed: action.answer.isCorrect ? { ...state.revealed, [action.answer.questionId]: true } : state.revealed,
      }
    case "submitting":
      return { ...state, status: "submitting", error: null }
    case "finished":
      return { ...state, status: "finished", mockResult: action.mockResult ?? null, review: action.review ?? null }
    case "failed":
      return { ...state, status: state.status === "submitting" ? "answering" : state.status, checking: false, error: action.error }
  }
}

type QuizSession = {
  quiz: Quiz
  questions: Question[]
  practice: boolean
  state: State
  current: Question
  /** Mock: questions with a pick. Practice: questions checked. */
  done: number
  /** Seconds left on a timed mock test, else null. */
  remaining: number | null
  go: (index: number) => void
  pick: (optionId: string) => void
  /** Mock: clear the current pick so the question counts as skipped. */
  unpick: () => void
  /** Practice: reveal whether the current pick is right. */
  check: () => Promise<void>
  /** Practice: clear a wrong answer so the question can be tried again. */
  retry: () => void
  /** Practice: give up on a wrong answer and show the correct one. */
  reveal: () => void
  /** Mock: submit for marks. Practice: save the session and open the review. */
  finish: () => Promise<void>
}

const QuizSessionContext = createContext<QuizSession | null>(null)

export function useQuizSession() {
  const session = use(QuizSessionContext)
  if (!session) throw new Error("useQuizSession must be used inside <QuizSessionProvider>")
  return session
}

export function QuizSessionProvider({
  quiz,
  onSaved,
  children,
}: {
  quiz: Quiz
  /** Called with the saved attempt so the page can add it to the student's history. */
  onSaved: (attempt: QuizAttempt) => void
  children: React.ReactNode
}) {
  const questions = useMemo(() => quiz.questions ?? [], [quiz.questions])
  const practice = isPractice(quiz)
  const user = useUser()!
  const [state, dispatch] = useReducer(reducer, null, () => startState(user.id, quiz, practice, questions))
  const current = questions[state.index]
  const busy = useRef(false)

  // Keep an unfinished practice run in the browser so the student can come back to it.
  useEffect(() => {
    if (!practice || state.status !== "answering") return
    try {
      if (Object.keys(state.checked).length === 0) {
        clearPracticeProgress(user.id, quiz.id)
        return
      }
      localStorage.setItem(
        progressKey(user.id, quiz.id),
        JSON.stringify({ picked: state.picked, checked: state.checked, revealed: state.revealed })
      )
    } catch {
      // Blocked or full storage: the test still works, it just can't be resumed.
    }
  }, [practice, state.status, state.picked, state.checked, state.revealed, user.id, quiz.id])

  const go = useCallback(
    (index: number) => dispatch({ type: "go", index: Math.max(0, Math.min(questions.length - 1, index)) }),
    [questions.length]
  )

  const unpick = useCallback(
    () => current && dispatch({ type: "unpick", questionId: current.id }),
    [current]
  )
  const pick = useCallback(
    (optionId: string) => current && dispatch({ type: "pick", questionId: current.id, optionId }),
    [current]
  )

  const check = useCallback(async () => {
    const optionId = current && state.picked[current.id]
    if (!practice || !optionId || state.checked[current.id] || busy.current) return
    busy.current = true
    dispatch({ type: "checking" })
    try {
      dispatch({ type: "checked", answer: await checkAnswer(quiz.id, current.id, optionId) })
    } catch (e) {
      dispatch({ type: "failed", error: errMsg(e) })
    } finally {
      busy.current = false
    }
  }, [practice, quiz.id, current, state.picked, state.checked])

  const retry = useCallback(() => current && dispatch({ type: "retry", questionId: current.id }), [current])
  const reveal = useCallback(() => current && dispatch({ type: "reveal", questionId: current.id }), [current])

  const finish = useCallback(async () => {
    if (state.status !== "answering" || busy.current) return
    busy.current = true
    dispatch({ type: "submitting" })
    try {
      if (practice) {
        // Only checked answers are part of the session; a picked but unchecked option was never answered.
        const answers = Object.values(state.checked).map((a) => ({ questionId: a.questionId, optionId: a.selectedOptionId! }))
        if (answers.length === 0) {
          clearPracticeProgress(user.id, quiz.id)
          dispatch({ type: "finished", review: [] })
          return
        }
        const attempt = await submitAttempt(quiz.id, answers)
        onSaved(attempt)
        clearPracticeProgress(user.id, quiz.id)
        dispatch({ type: "finished", review: attempt.answers ?? [] })
      } else {
        const answers = Object.entries(state.picked).map(([questionId, optionId]) => ({ questionId, optionId }))
        const result = await submitMockTest(quiz.id, answers)
        onSaved({
          id: result.attemptId,
          quizId: result.quizId,
          userId: "",
          score: result.score,
          total: result.total,
          passed: result.passed,
          startedAt: result.submittedAt,
          submittedAt: result.submittedAt,
          answers: result.answers ?? null,
        })
        dispatch({ type: "finished", mockResult: result })
      }
    } catch (e) {
      dispatch({ type: "failed", error: errMsg(e) })
    } finally {
      busy.current = false
    }
  }, [practice, quiz.id, state.status, state.picked, state.checked, onSaved, user.id])

  const remaining = useCountdown(practice ? null : quiz.timeLimitSec, state.status === "answering")

  // Time's up: hand in whatever has been answered, once. If that fails, the student can still submit by hand.
  const timeUp = useRef(false)
  useEffect(() => {
    if (remaining !== 0 || timeUp.current) return
    timeUp.current = true
    void finish()
  }, [remaining, finish])

  const done = practice ? Object.keys(state.checked).length : Object.keys(state.picked).length

  const value = useMemo<QuizSession>(
    () => ({ quiz, questions, practice, state, current, done, remaining, go, pick, unpick, check, retry, reveal, finish }),
    [quiz, questions, practice, state, current, done, remaining, go, pick, unpick, check, retry, reveal, finish]
  )

  return <QuizSessionContext value={value}>{children}</QuizSessionContext>
}

/** Seconds left of limitSec since mount, measured against a fixed deadline so it doesn't drift. Stops when not running. */
function useCountdown(limitSec: number | null, running: boolean) {
  const [deadline] = useState(() => (limitSec ? Date.now() + limitSec * 1000 : null))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deadline === null || !running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline, running])

  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}
