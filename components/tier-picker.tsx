"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { type ContentTier, TIER_LABEL } from "@/lib/api"

const PICKABLE: ContentTier[] = ["free", "plus", "premium"]

/**
 * Who can open an item. Free opens it for everyone; Plus and Premium for those tiers. Ultra is always
 * included, so its chip is shown pressed and can't be turned off.
 */
export function TierPicker({
  value,
  onChange,
  label = "Access",
  disabled,
}: {
  value: ContentTier[]
  onChange: (tiers: ContentTier[]) => void
  label?: string
  disabled?: boolean
}) {
  const chip =
    "h-8 rounded-full border-border bg-white px-3.5 text-[13px] font-normal text-gray-600 hover:text-heading data-[pressed]:border-navy data-[pressed]:bg-navy data-[pressed]:text-white"
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-heading">{label}</p>
      <ToggleGroup
        multiple
        aria-label={label}
        variant="outline"
        spacing={1.5}
        disabled={disabled}
        value={[...value, "ultra"]}
        onValueChange={(v: string[]) => onChange(PICKABLE.filter((t) => v.includes(t)))}
        className="flex-wrap"
      >
        {PICKABLE.map((t) => (
          <ToggleGroupItem key={t} value={t} className={chip}>
            {TIER_LABEL[t]}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="ultra" disabled aria-label="Ultra, always included" className={chip}>
          {TIER_LABEL.ultra}
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        {value.includes("free")
          ? "Everyone can open this, including students who aren't enrolled."
          : "Ultra is always included."}
      </p>
    </div>
  )
}
