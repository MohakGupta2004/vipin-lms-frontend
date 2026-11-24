"use client"

import { useState } from "react"

import { AppShell, errMsg } from "@/components/app-shell"
import { DiagnosticIntro } from "@/components/diagnostic/diagnostic-intro"
import { DiagnosticResult } from "@/components/diagnostic/diagnostic-result"
import { DiagnosticTest } from "@/components/diagnostic/diagnostic-test"
import { submitDiagnosticResult } from "@/lib/api"
import {
  scoreDiagnostic,
  type DiagnosticAnswer,
  type DiagnosticScore,
} from "@/lib/diagnostic-score"

type Stage = "intro" | "test" | "result"

export default function DiagnosticPage() {
  return (
    <AppShell>
      <DiagnosticFlow />
    </AppShell>
  )
}

function DiagnosticFlow() {
  const [stage, setStage] = useState<Stage>("intro")
  const [score, setScore] = useState<DiagnosticScore | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function submit(answers: DiagnosticAnswer[]) {
    const nextScore = scoreDiagnostic(answers)
    setScore(nextScore)
    setStage("result")
    setSaving(true)
    setSaveError(null)

    try {
      await submitDiagnosticResult({
        correct: nextScore.correct,
        total: nextScore.total,
        elements: nextScore.elements.map((element) => ({
          element: element.element,
          correct: element.correct,
          total: element.total,
          points: element.points,
          maxPoints: element.maxPoints,
        })),
        answers,
      })
    } catch (e) {
      setSaveError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  function restart() {
    setScore(null)
    setSaveError(null)
    setSaving(false)
    setStage("intro")
  }

  if (stage === "test") {
    return <DiagnosticTest onSubmit={submit} />
  }

  if (stage === "result" && score) {
    return (
      <DiagnosticResult
        score={score}
        saving={saving}
        saveError={saveError}
        onRestart={restart}
      />
    )
  }

  return <DiagnosticIntro onStart={() => setStage("test")} />
}
