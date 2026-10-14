"use client"

import { CircleNotchIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useState } from "react"

import { ErrorNote, errMsg } from "@/components/app-shell"
import { FlashcardForm } from "@/components/flashcard-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import {
  createDeck,
  deleteDeck,
  deleteFlashcard,
  listDeckCards,
  setDeckFree,
  updateDeckStatus,
  type DeckStatus,
  type Flashcard,
  type FlashcardDeck,
} from "@/lib/api"

/**
 * The owner's panel for one deck (a lesson's, or the course-wide one when lessonId is null):
 * status, make-all-free, and the cards with add, edit and delete. `deck` is null until the first
 * "Create flashcards"; onChange reports the deck after every change so the page can keep its counts.
 */
export function FlashcardDeckPanel({
  courseId,
  lessonId,
  deck,
  onChange,
}: {
  courseId: string
  lessonId: string | null
  deck: FlashcardDeck | null
  onChange: (deck: FlashcardDeck | null) => void
}) {
  const [cards, setCards] = useState<Flashcard[] | null>(null)
  const [status, setStatus] = useState<DeckStatus>("draft")
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deckId = deck?.id

  useEffect(() => {
    if (!deckId) return
    let stale = false
    listDeckCards(deckId)
      .then((c) => !stale && setCards(c))
      .catch((e) => !stale && setError(errMsg(e)))
    return () => {
      stale = true
    }
  }, [deckId])

  // Keeps the deck's counts in step with the card list without refetching.
  function sync(next: Flashcard[]) {
    setCards(next)
    if (deck) onChange({ ...deck, cardCount: next.length, freeCardCount: next.filter((c) => c.isFree).length })
  }

  async function run(fn: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!deck) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">No flashcards yet.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Status of the new deck" className="h-9 w-36" value={status} onChange={(e) => setStatus(e.target.value as DeckStatus)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                onChange(await createDeck(courseId, { lessonId, status }))
                setCards([])
                setAdding(true)
              })
            }
          >
            {busy ? <CircleNotchIcon className="animate-spin" /> : <PlusIcon />} Create flashcards
          </Button>
        </div>
        <ErrorNote error={error} />
      </div>
    )
  }

  const allFree = deck.cardCount > 0 && deck.freeCardCount === deck.cardCount

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Deck status"
          className="h-9 w-36"
          value={deck.status}
          disabled={busy}
          onChange={(e) => run(async () => onChange(await updateDeckStatus(deck.id, e.target.value as DeckStatus)))}
        >
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || deck.cardCount === 0}
          onClick={() =>
            run(async () => {
              const next = await setDeckFree(deck.id, !allFree)
              onChange(next)
              setCards((cs) => cs && cs.map((c) => ({ ...c, isFree: !allFree })))
            })
          }
        >
          {allFree ? "Make all paid" : "Make all free"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete deck"
          disabled={busy}
          className="hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            if (!confirm("Delete this flashcard deck and all its cards?")) return
            void run(async () => {
              await deleteDeck(deck.id)
              setCards(null)
              onChange(null)
            })
          }}
        >
          <TrashIcon />
        </Button>
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"} · {deck.freeCardCount} free
        </span>
      </div>

      {cards === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      <ul className="space-y-2">
        {cards?.map((c) =>
          c.id === editingId ? (
            <li key={c.id}>
              <FlashcardForm
                card={c}
                onSaved={(saved) => {
                  sync(cards.map((x) => (x.id === saved.id ? saved : x)))
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-1 rounded-md border border-border bg-white py-2 pr-2 pl-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-heading">{c.front}</span>
                <span className="block truncate text-xs text-muted-foreground">{c.back}</span>
              </span>
              {c.isFree && <Badge variant="lime">Free preview</Badge>}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit card ${c.front}`}
                onClick={() => {
                  setAdding(false)
                  setEditingId(c.id)
                }}
              >
                <PencilSimpleIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete card ${c.front}`}
                className="hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (!confirm("Delete this card?")) return
                  void run(async () => {
                    await deleteFlashcard(c.id)
                    sync(cards.filter((x) => x.id !== c.id))
                  })
                }}
              >
                <TrashIcon />
              </Button>
            </li>
          )
        )}
      </ul>

      <ErrorNote error={error} />

      {!adding && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingId(null)
            setAdding(true)
          }}
        >
          <PlusIcon /> Add a card
        </Button>
      )}
      {adding && cards && (
        <FlashcardForm deckId={deck.id} onSaved={(c) => sync([...cards, c])} onCancel={() => setAdding(false)} />
      )}
    </div>
  )
}
