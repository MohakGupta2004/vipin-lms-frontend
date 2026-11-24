"use client"

import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr"

import { PageTitle } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { DIAGNOSTIC_QUESTIONS } from "@/lib/diagnostic-questions"

export function DiagnosticIntro({ onStart }: { onStart: () => void }) {
  return (
    <>
      <PageTitle
        title="Skill diagnostic"
        subtitle="Find out which chapters of the exam you already know and which need work."
      />

      <section className="max-w-2xl space-y-6">
        <dl className="tnum grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-sm">
          <div className="bg-white px-5 py-4">
            <dt className="text-xs text-muted-foreground">Questions</dt>
            <dd className="mt-0.5 text-2xl font-semibold text-heading">{DIAGNOSTIC_QUESTIONS.length}</dd>
          </div>
          <div className="bg-white px-5 py-4">
            <dt className="text-xs text-muted-foreground">Time</dt>
            <dd className="mt-0.5 text-2xl font-semibold text-heading">About 60 min</dd>
          </div>
        </dl>

        <ul className="space-y-3 text-[15px] leading-relaxed text-gray-700">
          <li>You see one question at a time and can go back to change any answer.</li>
          <li>
            After each answer, tell us how sure you were: confident, unsure or guessing. A correct
            answer you were sure of scores more than a lucky guess.
          </li>
          <li>
            Nothing is marked while you take it. When you submit, you see your score in each of the
            nine exam chapters and which ones to review first.
          </li>
          <li>There is no timer. Your answers are only saved when you submit.</li>
        </ul>

        <Button size="lg" onClick={onStart}>
          Start the diagnostic
          <ArrowRightIcon />
        </Button>
      </section>
    </>
  )
}
