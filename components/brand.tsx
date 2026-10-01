import { GraduationCap } from "lucide-react"

import { cn } from "@/lib/utils"

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30">
        <GraduationCap className="size-5" />
      </div>
      <span className="text-lg font-semibold tracking-tight text-gray-900">
        LMS Platform
      </span>
    </div>
  )
}
