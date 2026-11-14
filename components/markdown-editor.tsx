"use client"

import { useState } from "react"

import { Markdown } from "@/components/markdown"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Mode = "write" | "preview" | "split"

/**
 * A Markdown textarea with a live preview. Wider screens show both side by side by default; phones switch between
 * Write and Preview.
 */
export function MarkdownEditor({
  id,
  value,
  onChange,
  maxLength,
  placeholder = "Write in Markdown — **bold**, _italic_, # headings, - lists, [links](https://…), tables…",
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
}) {
  const [mode, setMode] = useState<Mode>("split")

  const tabs: { value: Mode; label: string; desk?: boolean }[] = [
    { value: "write", label: "Write" },
    { value: "preview", label: "Preview" },
    { value: "split", label: "Side by side", desk: true },
  ]

  const showWrite = mode === "write" || mode === "split"
  const showPreview = mode === "preview" || mode === "split"

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Editor view" className="inline-flex rounded-md bg-black/[0.05] p-0.5">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={mode === t.value}
              onClick={() => setMode(t.value)}
              className={cn(
                "rounded-[5px] px-2.5 py-1 text-xs font-medium text-heading/60 transition-colors hover:text-heading",
                mode === t.value && "bg-white text-heading shadow-[0_1px_2px_rgba(10,37,64,0.12)]",
                t.desk && "hidden md:inline-block",
                // Phones have no split view: there it shows as Write.
                t.value === "write" && mode === "split" && "max-md:bg-white max-md:text-heading max-md:shadow-[0_1px_2px_rgba(10,37,64,0.12)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <a
          href="https://www.markdownguide.org/cheat-sheet/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 underline-offset-2 hover:underline"
        >
          Markdown supported
        </a>
      </div>
      <div className={cn("grid gap-3", mode === "split" && "md:grid-cols-2")}>
        <Textarea
          id={id}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn("min-h-64 resize-y font-mono text-base leading-relaxed md:text-[13px]", !showWrite && "hidden")}
        />
        <div
          aria-label="Preview"
          className={cn(
            "min-h-64 overflow-auto rounded-md border border-dashed border-input bg-black/[0.015] px-3 py-2.5",
            !showPreview && "hidden",
            mode === "split" && "max-md:hidden md:max-h-[32rem]"
          )}
        >
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-gray-400">Nothing to preview yet.</p>}
        </div>
      </div>
    </div>
  )
}
