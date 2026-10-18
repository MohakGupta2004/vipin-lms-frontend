"use client"

import { ArrowRightIcon, FileTextIcon, PencilSimpleIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

import { ErrorNote, errMsg } from "@/components/app-shell"
import { NoteForm } from "@/components/note-form"
import { Badge } from "@/components/ui/badge"
import { LockHint, LockedRow, TierBadge } from "@/components/tier-badge"
import { Button } from "@/components/ui/button"
import { deleteNote, type Note, type Tier } from "@/lib/api"

const size = (n: Note) => `PDF · ${(n.sizeBytes / 1024).toFixed(0)} KB`

/**
 * PDF note rows. Locked notes (not enrolled, or on a lower tier) show but can't be opened; `tier` is the viewer's
 * tier in the course. Pass onEdit and onDelete for the course owner's controls, who also see each note's tiers;
 * editingId swaps that row for `editor`.
 */
export function NoteList({
  notes,
  onOpen,
  onEdit,
  onDelete,
  tier,
  editingId,
  editor,
}: {
  notes: Note[]
  onOpen: (n: Note) => void
  onEdit?: (n: Note) => void
  onDelete?: (n: Note) => void
  tier?: Tier
  editingId?: string | null
  editor?: React.ReactNode
}) {
  return (
    <ul className="space-y-2">
      {notes.map((n) =>
        n.id === editingId ? (
          <li key={n.id}>{editor}</li>
        ) : n.locked ? (
          <LockedRow
            key={n.id}
            title={n.title}
            meta={size(n)}
            hint={<LockHint courseTier={tier} tags={n.tiers} />}
          />
        ) : (
          <li
            key={n.id}
            className="tap group/row flex items-center gap-1 rounded-md border border-border bg-white pr-2 hover:border-teal/40 hover:shadow-sm"
          >
            <button
              type="button"
              onClick={() => onOpen(n)}
              className="tap-link flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-md p-3 text-left"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors group-hover/row:bg-teal group-hover/row:text-white">
                <FileTextIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sm font-semibold break-words text-heading">
                  {n.title}
                </span>
                <span className="tnum flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {size(n)}
                  {onEdit ? <TierBadge tags={n.tiers} /> : n.tiers.includes("free") && <Badge variant="lime">Free preview</Badge>}
                </span>
              </span>
              <ArrowRightIcon className="size-4 shrink-0 text-heading/50 transition-transform duration-200 group-hover/row:translate-x-1" />
            </button>
            {onEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${n.title}`}
                onClick={() => onEdit(n)}
              >
                <PencilSimpleIcon />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${n.title}`}
                className="hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(n)}
              >
                <TrashIcon />
              </Button>
            )}
          </li>
        )
      )}
    </ul>
  )
}

/**
 * A lesson's notes with the owner's controls: share a PDF, edit a note's title, description and
 * tiers, or delete it. Everyone else just gets the list.
 */
export function LessonNotes({
  lessonId,
  notes,
  setNotes,
  isOwner,
  onOpen,
  tier,
  empty,
}: {
  lessonId: string
  notes: Note[]
  setNotes: (fn: (n: Note[]) => Note[]) => void
  isOwner: boolean
  onOpen: (n: Note) => void
  /** The viewer's tier in the course. */
  tier?: Tier
  /** Shown when the lesson has no notes. */
  empty: React.ReactNode
}) {
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const editing = notes.find((n) => n.id === editingId)

  async function remove(n: Note) {
    if (!confirm(`Delete "${n.title}"? The PDF will be removed.`)) return
    setError(null)
    try {
      await deleteNote(n.id)
      setNotes((ns) => ns.filter((x) => x.id !== n.id))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <div className="space-y-3">
      {notes.length === 0 && empty}
      <NoteList
        notes={notes}
        onOpen={onOpen}
        tier={tier}
        onEdit={
          isOwner
            ? (n) => {
                setUploading(false)
                setEditingId(n.id)
              }
            : undefined
        }
        onDelete={isOwner ? remove : undefined}
        editingId={editingId}
        editor={
          editing && (
            <NoteForm
              key={editing.id}
              note={editing}
              onSaved={(saved) => {
                setNotes((ns) => ns.map((x) => (x.id === saved.id ? saved : x)))
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          )
        }
      />
      <ErrorNote error={error} />
      {isOwner && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingId(null)
            setUploading((v) => !v)
          }}
        >
          <UploadSimpleIcon /> Share a note
        </Button>
      )}
      {isOwner && uploading && (
        <NoteForm
          lessonId={lessonId}
          onSaved={(n) => {
            setNotes((ns) => [n, ...ns])
            setUploading(false)
          }}
          onCancel={() => setUploading(false)}
        />
      )}
    </div>
  )
}
