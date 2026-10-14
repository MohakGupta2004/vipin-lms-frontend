"use client"

import { ArrowLeftIcon, CardsIcon } from "@phosphor-icons/react/dist/ssr"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { FlashcardPlayer } from "@/components/flashcard-player"
import { FlashcardSessionProvider } from "@/components/flashcard-session"
import { Empty, Loading } from "@/components/learning"
import { Button } from "@/components/ui/button"
import { useUser } from "@/hooks/use-user"
import { UUID_RE, getDeckSession, getMixSession, type Flashcard } from "@/lib/api"

export default function StudyPage() {
  return (
    <AppShell>
      <Suspense>
        <Study />
      </Suspense>
    </AppShell>
  )
}

/** ?deck=<id> studies one deck; ?mix=1 (optionally &course=<id>) shuffles cards across the student's courses. */
function Study() {
  const user = useUser()!
  const router = useRouter()
  const params = useSearchParams()
  const deckId = params.get("deck")
  const courseId = params.get("course")
  const mix = params.get("mix") === "1"
  const valid = deckId ? UUID_RE.test(deckId) : mix && (!courseId || UUID_RE.test(courseId))

  const [cards, setCards] = useState<Flashcard[] | null>(null)
  const [error, setError] = useState<string | null>(valid ? null : "That is not a valid flashcard link.")
  // Bumped by "Study again": refetches a fresh shuffle and remounts the session.
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!valid) return
    let stale = false
    const load = deckId ? getDeckSession(deckId) : getMixSession(courseId ?? undefined)
    load
      .then((c) => !stale && setCards(c))
      .catch((e) => !stale && setError(errMsg(e)))
    return () => {
      stale = true
    }
  }, [valid, deckId, courseId, run])

  // Back to wherever the student came from (the hub, the dashboard, a course page), else the hub.
  const leave = () => (window.history.length > 1 ? router.back() : router.push("/flashcards"))

  const restart = () => {
    setCards(null)
    setRun((n) => n + 1)
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={leave}>
        <ArrowLeftIcon /> Back
      </Button>
      <PageTitle title="Flashcards" subtitle="Tap a card to flip it, then rate how well you knew it." />
      <ErrorNote error={error} />
      {!cards && !error && <Loading rows={3} />}
      {cards && cards.length === 0 && (
        <Empty icon={CardsIcon} title="No cards to study" text="Nothing here is open to you yet. Check back once your instructor publishes more cards." />
      )}
      {cards && cards.length > 0 && (
        <FlashcardSessionProvider key={run} cards={cards} canRate={user.role === "student"}>
          <FlashcardPlayer onRestart={restart} onExit={leave} />
        </FlashcardSessionProvider>
      )}
    </>
  )
}
