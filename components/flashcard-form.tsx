"use client"

import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

import { ErrorNote, errMsg } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { TierPicker } from "@/components/tier-picker"
import { Textarea } from "@/components/ui/textarea"
import { type ContentTier, DEFAULT_TIERS, createFlashcard, updateFlashcard, type Flashcard } from "@/lib/api"

/** Adds a card to deck `deckId`, or edits `card` when given (front, back, who can study it). */
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
  // New cards start on Plus and Premium: only cards tagged Free open without enrolling.
  const [tiers, setTiers] = useState<ContentTier[]>(card?.tiers ?? DEFAULT_TIERS.flashcard)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const input = { front: front.trim(), back: back.trim(), tiers }
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
      <TierPicker value={tiers} onChange={setTiers} />
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
