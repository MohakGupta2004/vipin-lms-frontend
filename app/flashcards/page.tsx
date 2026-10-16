"use client"

import { CardsIcon } from "@phosphor-icons/react/dist/ssr"
import { Suspense, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { DeckRows, StudyBand } from "@/components/flashcard-links"
import { CourseChips, Empty, Loading, SectionHead, useCourseFilter } from "@/components/learning"
import { getMyFlashcards, listMyCourses, type Course, type MyFlashcards } from "@/lib/api"

export default function FlashcardsPage() {
  return (
    <AppShell roles={["student"]}>
      <Suspense>
        <Flashcards />
      </Suspense>
    </AppShell>
  )
}

function Flashcards() {
  const [courses, setCourses] = useState<Course[]>([])
  const [mine, setMine] = useState<MyFlashcards>({ recent: null, decks: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [courseId, setCourseId] = useCourseFilter(courses)

  useEffect(() => {
    Promise.all([listMyCourses(100, 0), getMyFlashcards()])
      .then(([c, f]) => {
        setCourses(c)
        setMine(f)
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [])

  const decks = courseId ? mine.decks.filter((d) => d.courseId === courseId) : mine.decks
  // The recent deck, unless the course filter hides it.
  const recent = mine.recent && !mine.recent.locked && (!courseId || mine.recent.courseId === courseId) ? mine.recent : null
  const perCourse = Object.fromEntries(courses.map((c) => [c.id, mine.decks.filter((d) => d.courseId === c.id).length]))

  return (
    <>
      <PageTitle title="Flashcards" subtitle="Quick revision of the key ideas. Flip a card, rate how well you knew it, move on." />
      <ErrorNote error={error} />
      {loading && <Loading rows={4} />}

      {!loading && !error && decks.length === 0 && courses.length === 0 && (
        <Empty icon={CardsIcon} title="No courses yet" text="Once you're enrolled in a course, its flashcards show up here." explore />
      )}

      {!loading && courses.length > 0 && (
        <>
          <CourseChips courses={courses} selected={courseId} onSelect={setCourseId} counts={perCourse} />
          {decks.length === 0 ? (
            <Empty icon={CardsIcon} title="No flashcards yet" text="Your instructor hasn't published any here yet. Check back soon." />
          ) : (
            <div className="space-y-6">
              <StudyBand deck={recent} courseId={courseId} />
              <section className="space-y-4">
                <SectionHead title="Decks" aside={<span className="tnum">{decks.length}</span>} />
                <DeckRows decks={decks} showCourse={!courseId && courses.length > 1} />
              </section>
            </div>
          )}
        </>
      )}
    </>
  )
}
