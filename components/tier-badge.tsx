import { LockIcon } from "@phosphor-icons/react/dist/ssr"

import { Badge } from "@/components/ui/badge"
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
 * Why a locked item is closed. Someone who isn't enrolled (courseTier "free") is told to enroll;
 * an enrolled student on a lower tier is told which tiers have it. Leave courseTier out in hubs,
 * where every course is one the student is enrolled in.
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
  if (courseTier === "free") {
    return (
      <span className={className ?? "inline-flex items-center gap-1.5"}>
        <Badge variant="outline">Enroll to unlock</Badge>
        <TierBadge tags={tags} />
      </span>
    )
  }
  return (
    <Badge variant="outline" className={className}>
      <LockIcon data-icon="inline-start" />
      Available on {tierAvailability(tags)}
    </Badge>
  )
}
