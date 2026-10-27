import { ArrowRightIcon, ListChecksIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { LockHint, LockedRow, TierBadge } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { QUIZ_TYPE_PLURAL, isPractice, type Quiz, type Tier } from "@/lib/api"

const meta = (q: Quiz) => {
  const parts = [`${q.questionCount} questions`]
  if (isPractice(q)) parts.push("Practice")
  else {
    if (q.timeLimitSec) parts.push(`${Math.round(q.timeLimitSec / 60)} min`)
    if (q.passPercent !== null) parts.push(`Pass ${q.passPercent}%`)
  }
  return parts.join(" · ")
}

/**
 * Test rows in two sections, Mock tests and Practice tests. Once there is any test both sections
 * show, each with its own empty state; with none at all the caller shows its own empty message.
 * Locked tests (not enrolled, or on a lower tier) show but can't be opened; `tier` is the viewer's tier in the
 * course. The owner sees each test's tiers.
 */
export function QuizList({
  quizzes,
  tier,
  owner,
  linkQuery,
  inset,
}: {
  quizzes: Quiz[]
  tier?: Tier
  owner?: boolean
  linkQuery?: string
  /** Desktop: rows sit inside the caller's grouped box; an empty group is left out instead of saying so. */
  inset?: boolean
}) {
  if (quizzes.length === 0) return null
  const groups = (["mock_test", "practice"] as const).map((t) => ({
    label: QUIZ_TYPE_PLURAL[t],
    items: quizzes.filter((q) => q.type === t),
  }))

  return (
    <div className={cn("space-y-4", inset && "md:space-y-0")}>
      {groups.map((g) => (
        <div
          key={g.label}
          className={cn(
            "space-y-2",
            inset && "md:space-y-0 md:not-first:border-t md:not-first:border-black/[0.06]",
            inset && g.items.length === 0 && "md:hidden"
          )}
        >
          <h4
            className={cn(
              "text-xs font-medium text-muted-foreground md:text-[12px] md:text-heading/45",
              inset && "md:px-3.5 md:pt-2.5 md:pb-1 md:text-[11px] md:font-semibold md:tracking-[0.05em] md:text-heading/40 md:uppercase"
            )}
          >
            {g.label}
          </h4>
          {g.items.length === 0 && (
            <p className="rounded-md border border-dashed border-border bg-white px-4 py-3 text-center text-sm text-muted-foreground md:border-0 md:bg-transparent md:p-0 md:py-1 md:text-left md:text-[13px] md:text-heading/40">
              No {g.label.toLowerCase()} yet.
            </p>
          )}
          <ul className="space-y-2 md:space-y-0 md:overflow-hidden md:rounded-xl md:bg-white md:shadow-[0_0_0_0.5px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.03)] md:empty:hidden">
            {g.items.map((q) =>
              q.locked ? (
                <LockedRow
                  key={q.id}
                  title={q.title}
                  meta={meta(q)}
                  hint={<LockHint courseTier={tier} tags={q.tiers} />}
                />
              ) : (
                <li key={q.id} className="md:not-last:border-b md:not-last:border-black/[0.06]">
                  <Link
                    href={`/quizzes/${q.id}${linkQuery ? `?${linkQuery}` : ""}`}
                    className="tap group/row flex items-center gap-3 rounded-md border border-border bg-white p-3 hover:border-teal/40 hover:shadow-sm active:border-teal/40 md:rounded-none md:border-0 md:px-3.5 md:py-2.5 md:hover:shadow-none"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-lime-soft text-navy transition-colors group-hover/row:bg-secondary md:size-auto md:bg-transparent md:text-heading/35 md:group-hover/row:bg-transparent">
                      <ListChecksIcon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm font-semibold break-words text-heading md:font-medium">
                        {q.title}
                      </span>
                      <span className="tnum flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {meta(q)}
                        {owner ? <TierBadge tags={q.tiers} /> : q.tiers.includes("free") && <Badge variant="lime">Free preview</Badge>}
                        {q.status === "draft" && (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </span>
                    </span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-heading/40 text-heading transition-colors duration-200 group-hover/row:border-teal group-hover/row:bg-teal group-hover/row:text-white md:size-5 md:border-0 md:text-heading/25 md:group-hover/row:bg-transparent md:group-hover/row:text-heading/60">
                      <ArrowRightIcon className="size-3.5" />
                    </span>
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </div>
  )
}
