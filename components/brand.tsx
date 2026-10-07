import { GraduationCap } from "lucide-react"

import { cn } from "@/lib/utils"

export function Brand({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-md",
          onDark ? "bg-secondary text-navy" : "bg-brand-blue text-white"
        )}
      >
        <GraduationCap className="size-5" strokeWidth={1.75} />
      </div>
      <span
        className={cn(
          "text-lg leading-none font-semibold tracking-tight",
          onDark ? "text-white" : "text-heading"
        )}
      >
        LMS Platform
      </span>
    </div>
  )
}
