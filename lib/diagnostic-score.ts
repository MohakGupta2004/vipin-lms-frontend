import {
  DIAGNOSTIC_ELEMENTS,
  DIAGNOSTIC_QUESTIONS,
  type DiagnosticQuestion,
} from "./diagnostic-questions"

/** How sure the person was when they picked an answer. */
export type DiagnosticConfidence = "high" | "medium" | "low" | "none"

export type DiagnosticAnswer = {
  questionId: number
  /** Index of the picked option. -1 means the question was left unanswered. */
  picked: number
  confidence: DiagnosticConfidence
}

export type ElementScore = {
  element: number
  correct: number
  total: number
  points: number
  maxPoints: number
  /** Points turned into 0-100, never below zero. */
  percent: number
}

export type DiagnosticScore = {
  correct: number
  total: number
  points: number
  maxPoints: number
  /** Overall percent from the number of correct answers. */
  percent: number
  elements: ElementScore[]
}

/** The confidence choices shown after every answer. */
export const CONFIDENCE_LABEL: Record<DiagnosticConfidence, string> = {
  high: "Confident",
  medium: "Unsure",
  low: "Guessing",
  none: "Not rated",
}

export const CONFIDENCE_EMOJI: Record<DiagnosticConfidence, string> = {
  high: "😎",
  medium: "🤔",
  low: "😬",
  none: "—",
}

/** One question's points: wrong -1, unanswered 0, correct +1 or +2 for high confidence. */
export function scoreQuestion(question: DiagnosticQuestion, answer: DiagnosticAnswer) {
  if (answer.picked < 0) {
    return { correct: false, points: 0 }
  }

  const correct = answer.picked === question.answer
  if (!correct) {
    return { correct: false, points: -1 }
  }

  if (answer.confidence === "high") {
    return { correct: true, points: 2 }
  }

  return { correct: true, points: 1 }
}

/** Points as a 0-100 percent, with negative totals clamped to zero. */
export function elementPercent(points: number, maxPoints: number) {
  if (maxPoints <= 0) return 0
  const clamped = Math.max(0, points)
  return Math.round((clamped / maxPoints) * 100)
}

type ElementPercentInput = {
  element: number
  points: number
  maxPoints: number
  /** Already worked out by the server, when it sends one. */
  percent?: number
}

/** The percent for an element from the API or from a local score. */
export function elementScorePercent(element: ElementPercentInput) {
  if (typeof element.percent === "number") return element.percent
  return elementPercent(element.points, element.maxPoints)
}

/** The element with the highest percent; ties go to more points. */
export function strongestElement<T extends ElementPercentInput>(elements: T[]): T {
  let best = elements[0]
  for (const element of elements) {
    const percent = elementScorePercent(element)
    const bestPercent = elementScorePercent(best)
    if (percent > bestPercent) best = element
    else if (percent === bestPercent && element.points > best.points) best = element
  }
  return best
}

/** The element with the lowest percent; ties go to fewer points. */
export function weakestElement<T extends ElementPercentInput>(elements: T[]): T {
  let worst = elements[0]
  for (const element of elements) {
    const percent = elementScorePercent(element)
    const worstPercent = elementScorePercent(worst)
    if (percent < worstPercent) worst = element
    else if (percent === worstPercent && element.points < worst.points) worst = element
  }
  return worst
}

/** Scores every question and rolls the answers up into one score per element. */
export function scoreDiagnostic(
  answers: DiagnosticAnswer[],
  questions: DiagnosticQuestion[] = DIAGNOSTIC_QUESTIONS
): DiagnosticScore {
  const answerByQuestion = new Map<number, DiagnosticAnswer>()
  for (const answer of answers) {
    answerByQuestion.set(answer.questionId, answer)
  }

  const elements: ElementScore[] = []
  for (let element = 1; element <= DIAGNOSTIC_ELEMENTS.length; element++) {
    elements.push({
      element,
      correct: 0,
      total: 0,
      points: 0,
      maxPoints: 0,
      percent: 0,
    })
  }

  let correctTotal = 0
  let pointsTotal = 0

  for (const question of questions) {
    const answer = answerByQuestion.get(question.id) ?? {
      questionId: question.id,
      picked: -1,
      confidence: "none" as DiagnosticConfidence,
    }
    const result = scoreQuestion(question, answer)
    const element = elements[question.element - 1]
    if (!element) continue

    element.total += 1
    element.maxPoints += 2
    element.points += result.points
    pointsTotal += result.points

    if (result.correct) {
      element.correct += 1
      correctTotal += 1
    }
  }

  for (const element of elements) {
    element.percent = elementPercent(element.points, element.maxPoints)
  }

  const total = questions.length
  return {
    correct: correctTotal,
    total,
    points: pointsTotal,
    maxPoints: total * 2,
    percent: total > 0 ? Math.round((correctTotal / total) * 100) : 0,
    elements,
  }
}
