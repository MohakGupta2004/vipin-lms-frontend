import { useId } from "react"

import { cn } from "@/lib/utils"

// Monogram: a "V" whose right stroke climbs past the frame as a growth arrow.
export function BrandMark({ className, onDark }: { className?: string; onDark?: boolean }) {
  const id = useId()
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-full", className)}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={onDark ? "hsl(var(--secondary))" : "hsl(var(--navy))"} />
          <stop offset="1" stopColor={onDark ? "hsl(var(--lime-hover))" : "hsl(var(--teal))"} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id}-bg)`} />
      {/* rising bars */}
      <g fill={onDark ? "hsl(var(--navy))" : "#fff"} opacity=".18">
        <rect x="8" y="26" width="4" height="7" rx="1" />
        <rect x="14.5" y="22" width="4" height="11" rx="1" />
        <rect x="21" y="18" width="4" height="15" rx="1" />
        <rect x="27.5" y="13" width="4" height="20" rx="1" />
      </g>
      <path
        d="M9 11.5 17.5 28 30 9"
        fill="none"
        stroke={onDark ? "hsl(var(--navy))" : "#fff"}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24.2 8.6 30.6 8.2 30.4 14.6"
        fill="none"
        stroke={onDark ? "hsl(var(--navy))" : "hsl(var(--secondary))"}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Brand({ className, onDark, compact }: { className?: string; onDark?: boolean; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="Vipin Garg, Financial Expert">
      <div className="size-10 shrink-0 drop-shadow-[0_2px_6px_rgba(10,37,64,0.18)]">
        <BrandMark onDark={onDark} />
      </div>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-lg leading-none font-semibold tracking-tight whitespace-nowrap",
            onDark ? "text-white" : "text-heading"
          )}
        >
          Vipin <span className={onDark ? "text-secondary" : "text-teal"}>Garg</span>
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 text-[10px] font-medium tracking-[0.22em] whitespace-nowrap uppercase",
              onDark ? "text-white/60" : "text-muted-foreground"
            )}
          >
            Financial Expert
          </span>
        )}
      </span>
    </div>
  )
}
