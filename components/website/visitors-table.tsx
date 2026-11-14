"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Toggle } from "@/components/ui/toggle"
import { listSiteVisitorEvents, listSiteVisitors, type SiteVisitor, type SiteVisitorEvent } from "@/lib/api"
import { cn } from "@/lib/utils"

const LIMIT = 50

function shortFingerprint(value: string) {
  if (!value) return "—"
  if (value.length <= 12) return value
  return `${value.slice(0, 12)}…`
}

function locationText(visitor: SiteVisitor) {
  const values = [visitor.city, visitor.region, visitor.country].filter((v) => v && v.trim())
  if (values.length === 0) return "Unknown"
  return values.join(", ")
}

function referrerText(value: string) {
  if (!value.trim()) return "direct"
  return value
}

function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIMIT))
}

function eventLabel(event: SiteVisitorEvent) {
  if (event.eventType === "click") {
    return `Click ${event.label || "(no label)"}`
  }
  if (event.eventType === "form_submit") {
    return `Form ${event.label || "(unknown)"}`
  }
  return "Pageview"
}

export function VisitorsTab() {
  const [returningOnly, setReturningOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<SiteVisitor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<SiteVisitor | null>(null)
  const [events, setEvents] = useState<SiteVisitorEvent[] | null>(null)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    listSiteVisitors({ limit: LIMIT, offset: page * LIMIT, returning: returningOnly ? "true" : undefined })
      .then((res) => {
        if (cancelled) return
        setTotal(res.total)
        setItems(res.items)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load visitors")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [returningOnly, page])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEventsLoading(true)
    setEventsError(null)
    listSiteVisitorEvents(selected.visitorId, 100)
      .then((rows) => {
        if (cancelled) return
        setEvents(rows)
      })
      .catch((e) => {
        if (cancelled) return
        setEventsError(e instanceof Error ? e.message : "Could not load visitor events")
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const maxPage = useMemo(() => pageCount(total), [total])

  return (
    <div className="space-y-4">
      <Card className="bg-white">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Visitors</CardTitle>
            <Toggle pressed={returningOnly} onPressedChange={(next) => setReturningOnly(!!next)} variant="outline" className="h-8 px-3 text-xs">
              Returning only
            </Toggle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visitors found.</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3">Last seen</TableHead>
                  <TableHead className="px-3">First seen</TableHead>
                  <TableHead className="px-3">Visits</TableHead>
                  <TableHead className="px-3">Pageviews</TableHead>
                  <TableHead className="px-3">Device</TableHead>
                  <TableHead className="px-3">Location</TableHead>
                  <TableHead className="px-3">Referrer / UTM</TableHead>
                  <TableHead className="px-3">Lead email</TableHead>
                  <TableHead className="px-3">Fingerprint</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((visitor) => {
                  const active = selected?.visitorId === visitor.visitorId
                  return (
                    <TableRow
                      key={visitor.visitorId}
                      className={cn("cursor-pointer", active && "bg-mint/40")}
                      onClick={() => {
                        setSelected(visitor)
                        setEvents(null)
                      }}
                    >
                      <TableCell className="max-w-0 px-3 text-xs text-muted-foreground">
                        <p className="truncate" title={new Date(visitor.lastSeenAt).toLocaleString()}>
                          {new Date(visitor.lastSeenAt).toLocaleString()}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 px-3 text-xs text-muted-foreground">
                        <p className="truncate" title={new Date(visitor.firstSeenAt).toLocaleString()}>
                          {new Date(visitor.firstSeenAt).toLocaleString()}
                        </p>
                      </TableCell>
                      <TableCell className="px-3">{visitor.visitCount}</TableCell>
                      <TableCell className="px-3">{visitor.pageviews}</TableCell>
                      <TableCell className="max-w-0 px-3">
                        <p className="truncate text-xs">{visitor.deviceType || "Unknown"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {visitor.browser || "Unknown"} · {visitor.os || "Unknown"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 px-3">
                        <p className="truncate text-xs" title={locationText(visitor)}>
                          {locationText(visitor)}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 px-3">
                        <p className="truncate text-xs" title={referrerText(visitor.firstReferrer)}>
                          {referrerText(visitor.firstReferrer)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={`${visitor.utmSource || ""} ${visitor.utmMedium || ""} ${visitor.utmCampaign || ""}`.trim()}>
                          {[visitor.utmSource, visitor.utmMedium, visitor.utmCampaign].filter((v) => v.trim()).join(" · ") || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 min-w-48 px-3">
                        <p className="truncate text-xs" title={visitor.leadEmail || ""}>
                          {visitor.leadEmail || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 px-3">
                        <p className="truncate font-mono text-xs" title={visitor.fingerprint || ""}>
                          {shortFingerprint(visitor.fingerprint)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">Matches: {visitor.fingerprintMatches}</p>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {maxPage}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage(Math.max(0, page - 1))}>
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page + 1 >= maxPage}
                onClick={() => setPage(Math.min(maxPage - 1, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base">Visitor journey</CardTitle>
            <p className="text-xs text-muted-foreground">
              {selected.visitorId} · {selected.events} total events
            </p>
          </CardHeader>
          <CardContent>
            {eventsError && <p className="text-sm text-red-600">{eventsError}</p>}
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground">Loading events…</p>
            ) : !events || events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events found.</p>
            ) : (
              <ol className="space-y-2">
                {events.map((event) => (
                  <li key={event.id} className="rounded-md border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary">{event.eventType}</Badge>
                      <time className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</time>
                    </div>
                    <p className="mt-1 text-sm text-heading">{eventLabel(event)}</p>
                    <p className="mt-0.5 break-all text-xs text-muted-foreground">
                      {event.path || ""}
                      {event.target ? ` · ${event.target}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
