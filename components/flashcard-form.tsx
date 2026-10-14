"use client"

import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

import { ErrorNote, errMsg } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { createFlashcard, updateFlashcard, type Flashcard } from "@/lib/api"

/** Adds a card to deck `deckId`, or edits `card` when given (front, back, free preview). */
export function FlashcardForm({
  deckId,
  card,
  onSaved,
  onCancel,
}: {
  deckId?: string
  card?: Flashcard
  onSaved: (c: Flashcard) => void
  onCancel?: () => void
}) {
  const editing = !!card
  const key = card?.id ?? deckId
  const [front, setFront] = useState(card?.front ?? "")
  const [back, setBack] = useState(card?.back ?? "")
  // New cards start paid: only cards marked free open without enrolling.
  const [isFree, setIsFree] = useState(card?.isFree ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const input = { front: front.trim(), back: back.trim(), isFree }
      onSaved(editing ? await updateFlashcard(card.id, input) : await createFlashcard(deckId!, input))
      if (!editing) {
        setFront("")
        setBack("")
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-white p-5 shadow-sm">
      <Field>
        <FieldLabel htmlFor={`ff-${key}`}>Front (question or term)</FieldLabel>
        <Textarea id={`ff-${key}`} required maxLength={500} className="min-h-16" value={front} onChange={(e) => setFront(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`fb-${key}`}>Back (answer)</FieldLabel>
        <Textarea id={`fb-${key}`} required maxLength={2000} className="min-h-24" value={back} onChange={(e) => setBack(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        Free preview (open without enrolling)
      </label>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <CircleNotchIcon className="animate-spin" />}
          {editing ? "Save card" : "Add card"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {editing ? "Cancel" : "Done"}
          </Button>
        )}
      </div>
    </form>
  )
}
