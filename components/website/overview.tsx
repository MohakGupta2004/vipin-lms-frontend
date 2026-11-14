"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import type { SiteKeyCount, SiteOverview } from "@/lib/api"

const RANGES = [7, 30, 90]

function prettyKey(value: string, fallback: string) {
  const clean = value.trim()
  if (!clean) return fallback
  return clean
}

function numberText(value: number) {
  return new Intl.NumberFormat().format(value)
}

function dayLabel(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
}

const CHART_HEIGHT = 120

function DailyBars({ overview }: { overview: SiteOverview }) {
  const max = overview.daily.reduce((top, row) => {
    const rowMax = Math.max(row.newVisitors, row.returningVisitors)
    if (rowMax > top) return rowMax
    return top
  }, 1)

  const lastIndex = overview.daily.length - 1

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-base">Visitors trend</CardTitle>
        <p className="text-xs text-muted-foreground">Days in UTC</p>
      </CardHeader>
      <CardContent>
        {overview.daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div>
            <div className="flex h-32 items-end gap-px">
              {overview.daily.map((row, i) => {
                const newHeight = row.newVisitors > 0 ? Math.max(2, Math.round((row.newVisitors / max) * CHART_HEIGHT)) : 0
                const returningHeight = row.returningVisitors > 0 ? Math.max(2, Math.round((row.returningVisitors / max) * CHART_HEIGHT)) : 0
                const tip = `${dayLabel(row.date)}: ${row.newVisitors} new, ${row.returningVisitors} returning, ${row.pageviews} pageviews, ${row.leads} leads`
                // a weekly label too close to the last one would overlap it
                const showLabel = i === 0 || i === lastIndex || (i % 7 === 0 && lastIndex - i > 3)
                let labelAlign = "text-center"
                if (i === 0) labelAlign = "text-left"
                if (i === lastIndex) labelAlign = "text-right"
                return (
                  <div key={row.date} title={tip} className="flex min-w-0 flex-1 flex-col justify-end">
                    <div className="flex h-32 items-end justify-center gap-px">
                      {newHeight > 0 && <div className="w-1/2 rounded-t-[2px] bg-navy/85" style={{ height: `${newHeight}px` }} />}
                      {returningHeight > 0 && <div className="w-1/2 rounded-t-[2px] bg-teal" style={{ height: `${returningHeight}px` }} />}
                      {newHeight === 0 && returningHeight === 0 && <div className="h-px w-full bg-border" />}
                    </div>
                    {/* labels may spill over the empty neighbouring days, so they are never cut */}
                    <p className={`mt-2 h-4 whitespace-nowrap text-[11px] text-muted-foreground ${labelAlign}`}>{showLabel ? dayLabel(row.date) : ""}</p>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-navy/85" /> New
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-teal" /> Returning
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HorizontalList({ title, items, emptyLabel, fallbackKey }: { title: string; items: SiteKeyCount[]; emptyLabel?: string; fallbackKey?: string }) {
  const max = items.reduce((top, item) => (item.count > top ? item.count : top), 1)
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel ?? "No data yet."}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const width = Math.max(2, Math.round((item.count / max) * 100))
              return (
                <li key={`${item.key}-${item.count}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <p className="truncate text-heading" title={item.key}>
                      {prettyKey(item.key, fallbackKey ?? "Unknown")}
                    </p>
                    <p className="tnum shrink-0 text-muted-foreground">{numberText(item.count)}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-navy" style={{ width: `${width}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function WebsiteOverview({ days, onDays, overview }: { days: number; onDays: (days: number) => void; overview: SiteOverview }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Unique" value={overview.uniqueVisitors} />
          <Stat label="New" value={overview.newVisitors} />
          <Stat label="Returning" value={overview.returningVisitors} />
          <Stat label="Pageviews" value={overview.pageviews} />
          <Stat label="Leads" value={overview.leads} />
        </div>
        <label className="text-sm text-muted-foreground">
          Range
          <Select className="mt-1 w-28" value={String(days)} onChange={(e) => onDays(Number(e.target.value))}>
            {RANGES.map((range) => (
              <option key={range} value={range}>
                {range} days
              </option>
            ))}
          </Select>
        </label>
      </div>

      <DailyBars overview={overview} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HorizontalList title="Leads by kind" items={overview.leadsByKind} />
        <HorizontalList title="Leads by course" items={overview.leadsByCourse} fallbackKey="none" />
        <HorizontalList title="Devices" items={overview.devices} fallbackKey="Unknown" />
        <HorizontalList title="Browsers" items={overview.browsers} fallbackKey="Unknown" />
        <HorizontalList title="Countries" items={overview.countries} fallbackKey="Unknown" />
        <HorizontalList title="Referrers" items={overview.referrers} fallbackKey="direct" />
        <HorizontalList title="Top pages" items={overview.topPages} fallbackKey="Unknown" />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-white py-3">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="display tnum mt-1 text-2xl text-heading">{numberText(value)}</p>
      </CardContent>
    </Card>
  )
}
