"use client"

import { CompassIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"
import type { Icon } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty as EmptyRoot, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Course, MyVideo, Video } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * The course a learning page is narrowed to, from `?course=`. With a single course there is nothing to
 * choose, so that course is always selected. An unknown ID falls back to all courses.
 */
export function useCourseFilter(courses: Course[]) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const requested = params.get("course")
  const selected = courses.length === 1 ? courses[0].id : courses.some((c) => c.id === requested) ? requested : null
  const select = (courseId: string | null) => {
    const next = new URLSearchParams(params)
    if (courseId) next.set("course", courseId)
    else next.delete("course")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  return [selected, select] as const
}

const ALL = "all"

/** "All courses" plus one toggle per course. Hidden when there is only one course to show. */
export function CourseChips({
  courses,
  selected,
  onSelect,
  counts,
}: {
  courses: Course[]
  selected: string | null
  onSelect: (courseId: string | null) => void
  /** Items per course, shown on each toggle; "All courses" shows their sum. */
  counts?: Record<string, number>
}) {
  if (courses.length < 2) return null
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined
  const items = [{ id: ALL, title: "All courses", n: total }, ...courses.map((c) => ({ id: c.id, title: c.title, n: counts?.[c.id] ?? 0 }))]
  const current = selected ?? ALL
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ToggleGroup
        aria-label="Course"
        variant="outline"
        spacing={1.5}
        value={[current]}
        onValueChange={(v: string[]) => {
          // A single-choice filter: clicking the selected toggle again keeps it selected.
          const next = v.find((x) => x !== current)
          if (next) onSelect(next === ALL ? null : next)
        }}
      >
        {items.map((c) => (
          <ToggleGroupItem
            key={c.id}
            value={c.id}
            className="h-8 rounded-full border-border bg-white px-3.5 text-[13px] font-normal text-gray-600 hover:text-heading data-[pressed]:border-navy data-[pressed]:bg-navy data-[pressed]:text-white"
          >
            {c.title}
            {counts && <span className="tnum text-xs opacity-60">{c.n}</span>}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** Line tabs, e.g. Practice tests / Mock tests. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <div className="overflow-x-auto border-b border-border">
        <TabsList variant="line" aria-label={label} className="h-10 gap-5 p-0">
          {options.map((o) => (
            <TabsTrigger key={o.value} value={o.value} className="flex-none px-0 text-sm font-normal data-active:font-medium">
              {o.label}
              {o.count !== undefined && <span className="tnum text-xs text-gray-400">{o.count}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  )
}

/** Key figures in one ruled card: serif numerals, hairline dividers. */
export function Figures({ items }: { items: { label: string; value: React.ReactNode; of?: number; note?: string; href?: string }[] }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {items.map((f, i) => {
          const body = (
            <>
              <dt className="text-[13px] text-muted-foreground">{f.label}</dt>
              <dd className="mt-2 flex items-baseline gap-1.5">
                <span className="display tnum text-[2rem] leading-none text-heading">{f.value}</span>
                {f.of !== undefined && <span className="tnum text-sm text-gray-400">of {f.of}</span>}
              </dd>
              {f.note && <p className="mt-1.5 text-xs text-gray-400">{f.note}</p>}
            </>
          )
          const cls = cn(
            "block px-5 py-5",
            i % 2 === 1 && "border-l border-border",
            i >= 2 && (i < 4 ? "border-t border-border sm:border-t-0" : "border-t border-border"),
            i % 4 !== 0 && "sm:border-l"
          )
          return f.href ? (
            <Link key={f.label} href={f.href} className={cn(cls, "transition-colors hover:bg-muted/60")}>
              {body}
            </Link>
          ) : (
            <div key={f.label} className={cls}>
              {body}
            </div>
          )
        })}
      </dl>
    </Card>
  )
}

/** The one dark accent on a page: the video to pick up again. */
export function ResumeBand({ video }: { video: MyVideo }) {
  const { pct } = watchState(video)
  return (
    <Link
      href={playerHref(video)}
      className="group relative flex items-center gap-5 overflow-hidden rounded-xl bg-navy px-5 py-5 text-white transition-colors hover:bg-[#143352] sm:px-7"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-navy transition-transform duration-200 group-hover:scale-105">
        <PlayIcon weight="fill" className="ml-0.5 size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-white/60">Continue watching</p>
        <p className="display mt-0.5 truncate text-[1.375rem] leading-tight">{video.title}</p>
        <p className="mt-1 truncate text-[13px] text-white/60">
          {video.courseTitle} · {video.lessonTitle}
        </p>
      </div>
      <div className="hidden w-44 shrink-0 text-right sm:block">
        <p className="tnum text-[13px] text-white/70">
          {pct !== null ? `${Math.round(pct)}% · ` : ""}at {clock(video.progress!.positionSec)}
        </p>
        {pct !== null && (
          <Progress
            value={Math.min(100, pct)}
            aria-label="Watched"
            className="mt-2 [&_[data-slot=progress-indicator]]:bg-secondary [&_[data-slot=progress-track]]:bg-white/15"
          />
        )}
      </div>
    </Link>
  )
}

export function Bar({ value, className, tone = "navy" }: { value: number; className?: string; tone?: "navy" | "primary" }) {
  return (
    <Progress
      value={Math.max(0, Math.min(100, value))}
      aria-label="Progress"
      className={cn(
        "gap-0 [&_[data-slot=progress-track]]:bg-gray-100",
        tone === "navy" ? "[&_[data-slot=progress-indicator]]:bg-navy" : "[&_[data-slot=progress-indicator]]:bg-primary",
        className
      )}
    />
  )
}

export type WatchState = "done" | "started" | "new"

/** Where a user is with a video, and how far in (0–100) when it is known. */
export function watchState(v: Pick<Video, "progress">): { state: WatchState; pct: number | null } {
  const p = v.progress
  if (p?.completedAt) return { state: "done", pct: 100 }
  if (p && p.positionSec > 0) return { state: "started", pct: p.durationSec ? (p.positionSec / p.durationSec) * 100 : null }
  return { state: "new", pct: null }
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function clock(sec: number) {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`
}

/** 5400 → "1h 30m", 300 → "5m", 20 → "<1m". */
export function hoursMinutes(sec: number) {
  const m = Math.round(sec / 60)
  if (sec > 0 && m === 0) return "<1m"
  const h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

export const playerHref = (v: Pick<Video, "id" | "courseId">) => `/courses/${v.courseId}/learn?v=${v.id}`

/** Placeholder rows while a list loads. */
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <Card aria-busy="true" aria-label="Loading" className="gap-0 py-0">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn("flex items-center gap-4 px-5 py-4", i > 0 && "border-t border-border")}>
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 flex-1" style={{ maxWidth: `${60 - i * 8}%` }} />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
      ))}
    </Card>
  )
}

export function Empty({ icon: EmptyIcon, title, text, explore }: { icon: Icon; title: string; text: string; explore?: boolean }) {
  return (
    <EmptyRoot className="rounded-xl border border-dashed border-gray-300 py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <EmptyIcon weight="duotone" />
        </EmptyMedia>
        <EmptyTitle className="display text-xl font-normal text-heading">{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      {explore && (
        <EmptyContent>
          <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <CompassIcon /> Explore courses
          </Link>
        </EmptyContent>
      )}
    </EmptyRoot>
  )
}

/** A section heading with an optional trailing link or count. */
export function SectionHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="display text-[1.625rem] leading-tight text-heading">{title}</h2>
      {aside && <div className="shrink-0 text-sm text-muted-foreground">{aside}</div>}
    </div>
  )
}
