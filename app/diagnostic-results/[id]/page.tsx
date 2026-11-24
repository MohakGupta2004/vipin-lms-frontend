"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { RadarChart } from "@/components/diagnostic/radar-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDiagnosticResult, type DiagnosticResultDetail } from "@/lib/api"
import { DIAGNOSTIC_ELEMENTS, DIAGNOSTIC_QUESTIONS } from "@/lib/diagnostic-questions"
import {
  CONFIDENCE_EMOJI,
  CONFIDENCE_LABEL,
  elementScorePercent,
  strongestElement,
  weakestElement,
} from "@/lib/diagnostic-score"

const LETTERS = "ABCDEFGHIJ"

const BACK = { href: "/diagnostic-results", label: "All results" }

export default function DiagnosticResultDetailPage() {
  return (
    <AppShell roles={["admin"]}>
      <ResultDetail />
    </AppShell>
  )
}

function ResultDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DiagnosticResultDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null)
    setError(null)
    getDiagnosticResult(id)
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch((e) => {
        if (cancelled) return
        setError(errMsg(e))
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <>
        <PageTitle back={BACK} title="Diagnostic result" />
        <ErrorNote error={error} />
      </>
    )
  }

  if (!data) {
    return (
      <>
        <PageTitle back={BACK} title="Diagnostic result" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </>
    )
  }

  const name = `${data.firstName} ${data.lastName}`.trim()
  const strongest = strongestElement(data.elements)
  const weakest = weakestElement(data.elements)

  const answersByQuestion = new Map<number, DiagnosticResultDetail["answers"][number]>()
  for (const answer of data.answers) {
    answersByQuestion.set(answer.questionId, answer)
  }

  return (
    <>
      <PageTitle back={BACK} title={name} subtitle={data.email} />

      <Card className="bg-white">
        <CardContent className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <RadarChart
            labels={data.elements.map((element) => elementName(element.element))}
            values={data.elements.map((element) => elementScorePercent(element))}
          />

          <div className="space-y-4">
            <p className="display tnum text-5xl text-heading">
              {data.correct}
              <span className="text-2xl text-gray-400">/{data.total}</span>
            </p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Strongest</dt>
                <dd className="font-medium text-heading">{elementName(strongest.element)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Weakest</dt>
                <dd className="font-medium text-heading">{elementName(weakest.element)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Taken</dt>
                <dd className="text-gray-700">{new Date(data.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-heading">Element breakdown</h2>
        <Card className="gap-0 overflow-hidden bg-white py-0">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Element</TableHead>
                <TableHead className="w-24">Correct</TableHead>
                <TableHead className="w-24">Points</TableHead>
                <TableHead className="w-24">Percent</TableHead>
                <TableHead className="w-24 pr-5">Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.elements.map((element) => {
                const percent = elementScorePercent(element)
                return (
                  <TableRow key={element.element}>
                    <TableCell className="pl-5 font-medium text-heading">
                      {elementName(element.element)}
                    </TableCell>
                    <TableCell className="tnum">
                      {element.correct}/{element.total}
                    </TableCell>
                    <TableCell className="tnum">
                      {element.points}/{element.maxPoints}
                    </TableCell>
                    <TableCell className="tnum">{percent}%</TableCell>
                    <TableCell className="pr-5">{strengthTag(percent)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-heading">Answers by element</h2>

        {DIAGNOSTIC_ELEMENTS.map((_, index) => {
          const elementNumber = index + 1
          const questions = DIAGNOSTIC_QUESTIONS.filter(
            (question) => question.element === elementNumber
          )
          const elementScore = data.elements.find(
            (element) => element.element === elementNumber
          )

          return (
            <Card key={elementNumber} className="bg-white">
              <CardHeader className="gap-1">
                <CardTitle>{elementName(elementNumber)}</CardTitle>
                {elementScore && (
                  <p className="text-sm text-muted-foreground">
                    {elementScore.correct}/{elementScore.total} correct ·{" "}
                    {elementScorePercent(elementScore)}%
                  </p>
                )}
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {questions.map((question) => {
                  const answer = answersByQuestion.get(question.id)
                  const picked = answer ? answer.picked : -1
                  const confidence = answer ? answer.confidence : "none"
                  const correct = picked === question.answer
                  const pickedText =
                    picked >= 0 && picked < question.options.length
                      ? `${LETTERS[picked]}. ${question.options[picked]}`
                      : "Unanswered"
                  const correctText = `${LETTERS[question.answer]}. ${question.options[question.answer]}`

                  return (
                    <div key={question.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                      <p className="text-xs text-muted-foreground">
                        Q{question.id}
                        <span className="mx-1.5">·</span>
                        <span
                          className={
                            picked < 0
                              ? ""
                              : correct
                                ? "font-medium text-green-700"
                                : "font-medium text-red-700"
                          }
                        >
                          {picked < 0 ? "Skipped" : correct ? "Correct" : "Wrong"}
                        </span>
                        {picked >= 0 && (
                          <>
                            <span className="mx-1.5">·</span>
                            {CONFIDENCE_EMOJI[confidence]} {CONFIDENCE_LABEL[confidence]}
                          </>
                        )}
                      </p>

                      <p className="text-sm font-medium whitespace-pre-line text-heading">
                        {question.question}
                      </p>

                      <div className="space-y-1 text-sm">
                        <p
                          className={
                            picked < 0
                              ? "text-muted-foreground"
                              : correct
                                ? "text-green-700"
                                : "text-red-700"
                          }
                        >
                          <span className="font-medium">Picked:</span> {pickedText}
                        </p>
                        {!correct && (
                          <p className="text-green-700">
                            <span className="font-medium">Correct:</span> {correctText}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </section>
    </>
  )
}

function elementName(element: number) {
  const found = DIAGNOSTIC_ELEMENTS[element - 1]
  return found ? found.name : `Element ${element}`
}

function strengthTag(percent: number) {
  if (percent >= 70) return <span className="font-medium text-green-700">Strong</span>
  if (percent <= 40) return <span className="font-medium text-red-700">Weak</span>
  return <span className="text-muted-foreground">Steady</span>
}
