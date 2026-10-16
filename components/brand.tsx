import Image from "next/image"

import logo from "@/public/logo.jpeg"
import logoDark from "@/public/logo-bw.jpeg"
import logoWhite from "@/public/logo-white.png"
import { cn } from "@/lib/utils"

// Circular mark; the image corners are clipped by rounded-full so every variant sits cleanly on any surface.
// white: the white-disc mark, used on the signed-out auth screens. It wins over onDark.
export function BrandMark({ className, onDark, white }: { className?: string; onDark?: boolean; white?: boolean }) {
  return (
    <Image
      src={white ? logoWhite : onDark ? logoDark : logo}
      alt=""
      aria-hidden="true"
      priority
      sizes="48px"
      className={cn("size-full rounded-full object-cover", className)}
    />
  )
}

export function Brand({
  className,
  onDark,
  compact,
  white,
}: {
  className?: string
  onDark?: boolean
  compact?: boolean
  /** Use the white-disc mark (signed-out auth screens only). */
  white?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="Vipin Garg, Finance Coach">
      <div className="size-9 shrink-0">
        <BrandMark onDark={onDark} white={white} />
      </div>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "display text-[1.3rem] leading-none font-medium whitespace-nowrap",
            onDark ? "text-white" : "text-heading"
          )}
        >
          Vipin Garg
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 text-[11px] whitespace-nowrap",
              onDark ? "text-white/60" : "text-muted-foreground"
            )}
          >
            Finance Coach
          </span>
        )}
      </span>
    </div>
  )
}
