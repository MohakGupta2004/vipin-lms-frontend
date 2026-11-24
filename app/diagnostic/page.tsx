"use client"

import { useEffect, useState } from "react"

import { AppShell, errMsg } from "@/components/app-shell"
import { DiagnosticIntro } from "@/components/diagnostic/diagnostic-intro"
import {
  DiagnosticAlreadyTaken,
  DiagnosticSubmitted,
} from "@/components/diagnostic/diagnostic-result"
import { DiagnosticTest } from "@/components/diagnostic/diagnostic-test"
import { ApiError, getDiagnosticStatus, submitDiagnosticResult } from "@/lib/api"
import { scoreDiagnostic, type DiagnosticAnswer } from "@/lib/diagnostic-score"

type Stage = "loading" | "intro" | "test" | "submitted" | "taken"

export default function DiagnosticPage() {
  return (
    <AppShell>
      <DiagnosticFlow />
    </AppShell>
  )
}

function DiagnosticFlow() {
  const [stage, setStage] = useState<Stage>("loading")
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Block a second attempt before the user starts.
  useEffect(() => {
    getDiagnosticStatus()
      .then((status) => setStage(status.taken ? "taken" : "intro"))
      .catch(() => setStage("intro"))
  }, [])

  async function save(finalAnswers: DiagnosticAnswer[]) {
    const score = scoreDiagnostic(finalAnswers)
    setSaving(true)
    setSaveError(null)

    try {
      await submitDiagnosticResult({
        correct: score.correct,
        total: score.total,
        elements: score.elements.map((element) => ({
          element: element.element,
          correct: element.correct,
          total: element.total,
          points: element.points,
          maxPoints: element.maxPoints,
        })),
        answers: finalAnswers,
      })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setStage("taken")
      } else {
        setSaveError(errMsg(e))
      }
    } finally {
      setSaving(false)
    }
  }

  async function submit(finalAnswers: DiagnosticAnswer[]) {
    setAnswers(finalAnswers)
    setStage("submitted")
    await save(finalAnswers)
  }

  if (stage === "loading") {
    return null
  }

  if (stage === "taken") {
    return <DiagnosticAlreadyTaken />
  }

  if (stage === "test") {
    return <DiagnosticTest onSubmit={submit} />
  }

  if (stage === "submitted") {
    return (
      <DiagnosticSubmitted
        saving={saving}
        saveError={saveError}
        onRetry={() => save(answers)}
      />
    )
  }

  return <DiagnosticIntro onStart={() => setStage("test")} />
}
