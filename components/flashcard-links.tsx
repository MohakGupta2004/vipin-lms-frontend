"use client"

import { ArrowRightIcon, CardsIcon, CaretRightIcon, ShuffleIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { Bar } from "@/components/learning"
import { LockedRow } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { FlashcardDeck, Tier } from "@/lib/api"
import { cn } from "@/lib/utils"

export const deckHref = (deckId: string) => `/flashcards/study?deck=${deckId}`
export const mixHref = (courseId?: string | null) => `/flashcards/study?mix=1${courseId ? `&course=${courseId}` : ""}`
export const deckName = (d: Pick<FlashcardDeck, "lessonId" | "lessonTitle">) => (d.lessonId ? d.lessonTitle || "Lesson" : "Course-wide")

/** The dark call-to-action: study the deck of the lesson you worked on last, or a random mix. */
export function StudyBand({ deck, courseId }: { deck?: FlashcardDeck | null; courseId?: string | null }) {
  return (
    <Link
      href={deck ? deckHref(deck.id) : mixHref(courseId)}
      className="group relative flex items-center gap-5 overflow-hidden rounded-xl bg-navy px-5 py-5 text-white transition-colors hover:bg-[#143352] sm:px-7"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-navy transition-transform duration-200 group-hover:scale-105">
        {deck ? <CardsIcon weight="fill" className="size-5" /> : <ShuffleIcon weight="bold" className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-white/60">{deck ? "Continue with flashcards" : "Quick revision"}</p>
        <p className="display mt-0.5 truncate text-[1.375rem] leading-tight">
          {deck ? `${deckName(deck)} flashcards` : "Random mix from your courses"}
        </p>
        {deck && (
          <p className="mt-1 truncate text-[13px] text-white/60">
            {deck.courseTitle} · {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
          </p>
        )}
      </div>
      {deck && (
        <p className="tnum hidden shrink-0 text-right text-[13px] text-white/70 sm:block">
          {deck.myMastered} of {deck.cardCount} mastered
        </p>
      )}
    </Link>
  )
}

/** One row per deck: where it belongs, how many cards, how many you've mastered. */
export function DeckRows({ decks, showCourse }: { decks: FlashcardDeck[]; showCourse: boolean }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <ul className="divide-y divide-border">
        {decks.map((d) => {
          const pct = d.cardCount ? Math.round((d.myMastered / d.cardCount) * 100) : 0
          if (d.locked)
            return (
              <LockedRow
                key={d.id}
                className="rounded-none border-0 px-5 py-4"
                title={deckName(d)}
                meta={`${showCourse ? `${d.courseTitle} · ` : ""}${d.cardCount} ${d.cardCount === 1 ? "card" : "cards"}`}
                hint={<Badge variant="outline">Not on your plan</Badge>}
              />
            )
          return (
            <li key={d.id}>
              <Link
                href={deckHref(d.id)}
                className="group grid touch-manipulation grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 sm:grid-cols-[minmax(0,1fr)_11rem_1rem]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] text-heading">{deckName(d)}</p>
                  <p className="tnum mt-0.5 truncate text-xs text-muted-foreground">
                    {showCourse && `${d.courseTitle} · `}
                    {d.cardCount} {d.cardCount === 1 ? "card" : "cards"}
                    {d.myReviewed > 0 && ` · ${d.myReviewed} reviewed`}
                  </p>
                </div>
                <div className="flex items-center gap-3 max-sm:col-span-2">
                  <Bar value={pct} className="flex-1" />
                  <span className="tnum w-20 text-right text-xs text-heading">{d.myMastered} mastered</span>
                </div>
                <CaretRightIcon className="hidden size-4 text-gray-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-heading sm:block" />
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/**
 * A deck as non-owners see it on a course page: its size and a link to study it. Only the cards the viewer's
 * `tier` can study open; a deck with none shows why it is locked.
 */
export function DeckSummary({ deck, tier, title }: { deck: FlashcardDeck | null; tier?: Tier; title?: string }) {
  if (!deck || deck.cardCount === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-muted-foreground">
        No flashcards yet.
      </p>
    )
  }
  const open = deck.accessibleCardCount
  const partial = open < deck.cardCount
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors group-hover/row:bg-teal group-hover/row:text-white">
        <CardsIcon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm font-semibold break-words text-heading">
          {title ?? `${deck.cardCount} ${deck.cardCount === 1 ? "card" : "cards"}`}
        </span>
        <span className="tnum block text-xs text-muted-foreground">
          {title && `${deck.cardCount} ${deck.cardCount === 1 ? "card" : "cards"} · `}
          {partial ? `${open} of ${deck.cardCount} open on your plan` : deck.myReviewed > 0 ? `${deck.myMastered} mastered` : "Not studied yet"}
        </span>
      </span>
    </>
  )
  // The whole card opens the deck; a deck with nothing open only says why.
  if (open === 0)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-gray-50 p-3">
        {body}
        <Badge variant="outline">{tier === "free" ? "Enroll to unlock" : "Not on your plan"}</Badge>
      </div>
    )
  return (
    <Link
      href={deckHref(deck.id)}
      className="tap group/row flex items-center gap-3 rounded-md border border-border bg-white p-3 hover:border-teal/40 hover:shadow-sm active:border-teal/40"
    >
      {body}
      <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none shrink-0")}>
        Study <ArrowRightIcon />
      </span>
    </Link>
  )
}
