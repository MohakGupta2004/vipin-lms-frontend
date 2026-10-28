"use client"

import { ArrowRightIcon, CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { CourseBatchBadges } from "@/components/course-badges"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { batchLabel, listCatalog, type CatalogCourse } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function ExplorePage() {
  return (
    <AppShell roles={["student", "instructor"]}>
      <Explore />
    </AppShell>
  )
}

function Explore() {
  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")

  useEffect(() => {
    listCatalog()
      .then(setCourses)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [])

  const needle = q.trim().toLowerCase()
  const shown = courses.filter((c) => !needle || c.title.toLowerCase().includes(needle))

  return (
    <>
      <PageTitle title="Explore courses" subtitle="Browse every course, open any lesson that is free and see what an enrollment adds." />

      <label className="relative block sm:max-w-xs">
        <span className="sr-only">Search courses</span>
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses" className="pl-9" />
      </label>

      <ErrorNote error={error} />
      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <CircleNotchIcon className="size-4 animate-spin" /> Loading…
        </p>
      )}
      {!loading && !error && shown.length === 0 && (
        <Card className="bg-white">
          <CardContent className="py-10 text-center text-sm text-gray-500">
            {needle ? "No courses match your search." : "No courses yet."}
          </CardContent>
        </Card>
      )}

      {shown.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c, i) => (
            <li key={c.id} className="rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
              <CourseCard c={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function CourseCard({ c }: { c: CatalogCourse }) {
  const counts = [
    c.lessonCount > 0 && `${c.lessonCount} ${c.lessonCount === 1 ? "lesson" : "lessons"}`,
    c.videoCount > 0 && `${c.videoCount} ${c.videoCount === 1 ? "video" : "videos"}`,
  ].filter(Boolean)

  return (
    <article className="tap relative flex h-full flex-col rounded-xl border border-border bg-white p-4 hover:border-teal/40 hover:shadow-sm sm:p-6">
      {(c.enrolled || c.isFree || batchLabel(c)) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {c.enrolled && <Badge>Enrolled</Badge>}
          {c.isFree && <Badge variant="lime">Free course</Badge>}
          <CourseBatchBadges course={c} />
        </div>
      )}

      <h3 className="display text-lg leading-snug text-heading sm:text-[1.375rem]">
        <Link href={`/courses/${c.id}?from=explore`} className="tap-link break-words after:absolute after:inset-0 after:rounded-xl hover:text-teal">
          {c.title}
        </Link>
      </h3>
      {c.shortDescription && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600">{c.shortDescription}</p>}

      <div className="mt-auto space-y-4 pt-5">
        {counts.length > 0 && <p className="tnum text-xs text-muted-foreground">{counts.join(" · ")}</p>}
        <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}>
          View course <ArrowRightIcon />
        </span>
      </div>
    </article>
  )
}
