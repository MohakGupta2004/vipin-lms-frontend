"use client"

import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

import { ErrorNote, errMsg } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { TierPicker } from "@/components/tier-picker"
import { type ContentTier, DEFAULT_TIERS, updateNote, uploadNote, type Note } from "@/lib/api"

const MAX_PDF = 25 * 1024 * 1024

/**
 * Uploads a PDF note to `lessonId`, or edits `note` when given (title, description, who can open it;
 * the PDF itself can't be replaced).
 */
export function NoteForm({
  lessonId,
  note,
  onSaved,
  onCancel,
}: {
  lessonId?: string
  note?: Note
  onSaved: (n: Note) => void
  onCancel?: () => void
}) {
  const editing = !!note
  const key = note?.id ?? lessonId
  const [title, setTitle] = useState(note?.title ?? "")
  const [description, setDescription] = useState(note?.description ?? "")
  // New notes start on Plus and Premium: only notes tagged Free open without enrolling, even in a free lesson.
  const [tiers, setTiers] = useState<ContentTier[]>(note?.tiers ?? DEFAULT_TIERS.note)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!editing) {
      if (!file) return setError("Choose a PDF file.")
      if (
        !/\.pdf$/i.test(file.name) ||
        (file.type && file.type !== "application/pdf")
      )
        return setError("Only PDF files are allowed.")
      if (file.size > MAX_PDF)
        return setError("The PDF must be 25 MB or smaller.")
    }
    setSaving(true)
    try {
      const input = {
        title: title.trim(),
        description: description.trim(),
        tiers,
      }
      onSaved(
        editing
          ? await updateNote(note.id, input)
          : await uploadNote(lessonId!, { ...input, file: file! })
      )
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-border bg-white p-5 shadow-sm"
    >
      <Field>
        <FieldLabel htmlFor={`nt-${key}`}>Title</FieldLabel>
        <Input
          id={`nt-${key}`}
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`nd-${key}`}>Description (optional)</FieldLabel>
        <Input
          id={`nd-${key}`}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      {!editing && (
        <Field>
          <FieldLabel htmlFor={`nf-${key}`}>PDF (max 25 MB)</FieldLabel>
          <Input
            id={`nf-${key}`}
            type="file"
            accept="application/pdf,.pdf"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      )}
      <TierPicker value={tiers} onChange={setTiers} />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="max-sm:flex-1">
          {saving && <CircleNotchIcon className="animate-spin" />}
          {editing ? "Save note" : "Upload"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
