"use client"

import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useEffect, useState } from "react"

import { ErrorNote, PageTitle } from "@/components/app-shell"
import { RadarChart } from "@/components/diagnostic/radar-chart"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DIAGNOSTIC_ELEMENTS } from "@/lib/diagnostic-questions"
import type { DiagnosticScore, ElementScore } from "@/lib/diagnostic-score"

function chapterName(element: number) {
  const found = DIAGNOSTIC_ELEMENTS[element - 1]
  return found ? found.name : `Chapter ${element}`
}

/** Highest percent first. */
function rankChapters(elements: ElementScore[]) {
  const ranked = [...elements]
  ranked.sort((a, b) => b.percent - a.percent)
  return ranked
}

function joinNames(elements: ElementScore[]) {
  return elements.map((element) => chapterName(element.element)).join(", ")
}

export function DiagnosticResult({
  score,
  saving,
  saveError,
  onRestart,
}: {
  score: DiagnosticScore
  saving: boolean
  saveError: string | null
  onRestart: () => void
}) {
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setDrawn(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const ranked = rankChapters(score.elements)
  const strongest = ranked.slice(0, 2)
  const toReview = ranked.slice(-2).reverse()

  return (
    <>
      <PageTitle title="Your result" subtitle="How you did in each chapter of the exam." />

      <ErrorNote error={saveError} />

      <Card className="pop overflow-hidden bg-navy">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm text-white/75">Overall</div>
            <div className="tnum text-5xl font-semibold text-white sm:text-6xl">
              {score.correct}
              <span className="text-2xl text-white/60 sm:text-3xl">/{score.total}</span>
              <span className="ml-3 text-2xl font-normal text-white/75 sm:text-3xl">
                {score.percent}%
              </span>
            </div>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-white/60">Strongest chapters</dt>
              <dd className="font-medium text-white">{joinNames(strongest)}</dd>
            </div>
            <div>
              <dt className="text-white/60">Chapters to review</dt>
              <dd className="font-medium text-white">{joinNames(toReview)}</dd>
            </div>
          </dl>
          {saving && <p className="text-xs text-white/60">Saving your result</p>}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
          <RadarChart
            labels={score.elements.map((element) => chapterName(element.element))}
            values={score.elements.map((element) => element.percent)}
          />

          <ul className="divide-y divide-border">
            {ranked.map((element) => (
              <li key={element.element} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-heading">{chapterName(element.element)}</span>
                  <span className="tnum shrink-0 text-sm text-muted-foreground">
                    {element.correct}/{element.total} right
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-teal transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{ width: drawn ? `${element.percent}%` : "0%" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onRestart}>
          <ArrowClockwiseIcon /> Take it again
        </Button>
        <Link href="/feed" className={buttonVariants({ variant: "outline" })}>
          Back to dashboard
        </Link>
      </div>
    </>
  )
}
