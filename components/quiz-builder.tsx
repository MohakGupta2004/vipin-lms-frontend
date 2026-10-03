"use client"

import { Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { ErrorNote, errMsg } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createQuiz, type Quiz, type QuizStatus } from "@/lib/api"

type Draft = { text: string; explanation: string; options: string[]; correct: number }

const blank = (): Draft => ({ text: "", explanation: "", options: ["", ""], correct: 0 })

export function QuizBuilder({ lessonId, onCreated }: { lessonId: string; onCreated: (q: Quiz) => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [passPercent, setPass] = useState(70)
  const [minutes, setMinutes] = useState("")
  const [status, setStatus] = useState<QuizStatus>("published")
  const [questions, setQuestions] = useState<Draft[]>([blank()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (i: number, p: Partial<Draft>) =>
    setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...p } : q)))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const quiz = await createQuiz(lessonId, {
        title: title.trim(),
        description: description.trim(),
        passPercent,
        timeLimitSec: minutes ? Math.round(Number(minutes) * 60) : undefined,
        status,
        questions: questions.map((q) => ({
          questionText: q.text.trim(),
          explanation: q.explanation.trim(),
          options: q.options.map((o, i) => ({ optionText: o.trim(), isCorrect: i === q.correct })),
        })),
      })
      onCreated(quiz)
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`qt-${lessonId}`}>Quiz title</FieldLabel>
          <Input id={`qt-${lessonId}`} required maxLength={200} value={title} className="h-10 bg-white" onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel>Description</FieldLabel>
          <Input maxLength={2000} value={description} className="h-10 bg-white" onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>Pass mark (%)</FieldLabel>
          <Input type="number" min={0} max={100} required value={passPercent} className="h-10 bg-white" onChange={(e) => setPass(Number(e.target.value))} />
        </Field>
        <Field>
          <FieldLabel>Time limit (minutes, optional)</FieldLabel>
          <Input type="number" min={1} max={1440} value={minutes} className="h-10 bg-white" onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value as QuizStatus)}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </Select>
        </Field>
      </div>

      {questions.map((q, i) => (
        <fieldset key={i} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium text-gray-900">Question {i + 1}</legend>
            {questions.length > 1 && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}>
                <Trash2 />
              </Button>
            )}
          </div>
          <Textarea required aria-label={`Question ${i + 1} text`} placeholder="Question" className="min-h-14" maxLength={2000} value={q.text} onChange={(e) => patch(i, { text: e.target.value })} />
          <div className="space-y-2">
            {q.options.map((o, j) => (
              <div key={j} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${lessonId}-${i}`}
                  checked={q.correct === j}
                  onChange={() => patch(i, { correct: j })}
                  aria-label={`Option ${j + 1} is correct`}
                />
                <Input
                  required
                  aria-label={`Question ${i + 1} option ${j + 1}`}
                  placeholder={`Option ${j + 1}`}
                  maxLength={1000}
                  value={o}
                  className="h-9 bg-white"
                  onChange={(e) => patch(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })}
                />
                {q.options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove option ${j + 1}`}
                    onClick={() =>
                      patch(i, {
                        options: q.options.filter((_, k) => k !== j),
                        correct: q.correct === j ? 0 : q.correct > j ? q.correct - 1 : q.correct,
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            {q.options.length < 10 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => patch(i, { options: [...q.options, ""] })}>
                <Plus /> Add option
              </Button>
            )}
          </div>
          <Input aria-label={`Question ${i + 1} explanation`} placeholder="Explanation shown after submitting (optional)" maxLength={5000} value={q.explanation} className="h-9 bg-white" onChange={(e) => patch(i, { explanation: e.target.value })} />
        </fieldset>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, blank()])}>
        <Plus /> Add question
      </Button>
      <ErrorNote error={error} />
      <div>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Create quiz
        </Button>
      </div>
    </form>
  )
}
