import { LockIcon } from "@phosphor-icons/react/dist/ssr"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { type ContentTier, type Tier, tierAvailability } from "@/lib/api"

/** Who can open an item: "Free", "Plus · Premium · Ultra" or "Ultra only". */
export function TierBadge({ tags, className }: { tags: readonly ContentTier[] | null | undefined; className?: string }) {
  const free = !!tags?.includes("free")
  return (
    <Badge variant={free ? "lime" : "tag"} className={className}>
      {tierAvailability(tags)}
    </Badge>
  )
}

/**
 * Why a locked item is closed. Someone previewing a course they aren't enrolled in (courseTier "free") gets
 * nothing: the lock icon says it all, and plan names mean nothing to them yet. An enrolled student on a lower
 * tier is told which tiers have it. Leave courseTier out in hubs, where every course is one the student is
 * enrolled in.
 */
export function LockHint({
  courseTier,
  tags,
  className,
}: {
  courseTier?: Tier
  tags: readonly ContentTier[] | null | undefined
  className?: string
}) {
  if (courseTier === "free") return null
  return (
    <Badge variant="outline" className={className}>
      <LockIcon data-icon="inline-start" />
      Available on {tierAvailability(tags)}
    </Badge>
  )
}

/**
 * A locked row: icon, then the full title (wraps, never truncates), a meta line and the lock hint on its own
 * wrapping line. One stacked layout at every width, so a narrow column can't squeeze the title away.
 */
export function LockedRow({
  title,
  meta,
  hint,
  className,
  as: Tag = "li",
}: {
  title: string
  meta: React.ReactNode
  hint: React.ReactNode
  className?: string
  /** "div" when the caller already wraps the row in its own <li>. */
  as?: "li" | "div"
}) {
  return (
    <Tag
      className={cn("flex items-start gap-3 rounded-md border border-border bg-gray-50 p-3", className)}
      aria-label={`${title}, locked`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
        <LockIcon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="line-clamp-2 block text-sm font-semibold break-words text-gray-600">{title}</span>
        <span className="tnum flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">{meta}</span>
        <span className="flex flex-wrap items-center gap-1.5 empty:hidden">{hint}</span>
      </span>
    </Tag>
  )
}
