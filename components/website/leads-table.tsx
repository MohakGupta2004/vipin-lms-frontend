"use client"

import { useEffect, useMemo, useState } from "react"

import { CopyEmailsButton } from "@/components/website/copy-emails-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { listSiteLeads, type SiteKeyCount, type SiteLead, type SiteLeadKind } from "@/lib/api"

const LIMIT = 50

export const KIND_LABELS: Record<string, string> = {
  masterclass: "Masterclass",
  diagnostic: "Diagnostic",
  contact: "Contact",
  firms: "Firms",
  newsletter: "Newsletter",
  interest: "Interest",
}

export const KIND_ORDER: SiteLeadKind[] = ["masterclass", "diagnostic", "contact", "firms", "newsletter", "interest"]

function kindCountMap(items: SiteKeyCount[]) {
  const map: Record<string, number> = {}
  for (const item of items) {
    map[item.key] = item.count
  }
  return map
}

function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / LIMIT))
}

function leadCourseText(lead: SiteLead) {
  if (!lead.courseSlugs || lead.courseSlugs.length === 0) return "—"
  return lead.courseSlugs.join(", ")
}

function dateText(iso: string) {
  return new Date(iso).toLocaleString()
}

function cleanCourse(course: string) {
  if (!course.trim()) return ""
  return course
}

export function MasterclassLeadsTab({ courses }: { courses: string[] }) {
  const [course, setCourse] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<SiteLead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    listSiteLeads({ kind: "masterclass", course: cleanCourse(course) || undefined, q: query || undefined, limit: LIMIT, offset: page * LIMIT })
      .then((res) => {
        if (cancelled) return
        setTotal(res.total)
        setItems(res.items)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load leads")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [course, query, page])

  const maxPage = pageCount(total)

  return (
    <Card className="bg-white">
      <CardHeader className="space-y-3">
        <CardTitle>Masterclass leads</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-muted-foreground">
            Course
            <Select className="mt-1 w-44" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((slug) => (
                <option key={slug} value={slug}>
                  {slug}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-muted-foreground">
            Search
            <Input className="mt-1 w-64" placeholder="Name, email or company" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <CopyEmailsButton kind="masterclass" course={course || undefined} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No masterclass leads found.</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">Email</TableHead>
                <TableHead className="px-3">Course</TableHead>
                <TableHead className="px-3">Consent</TableHead>
                <TableHead className="px-3">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="max-w-0 min-w-40 px-3">
                    <p className="truncate" title={lead.name}>
                      {lead.name || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-0 min-w-56 px-3">
                    <p className="truncate" title={lead.email}>
                      {lead.email}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-0 px-3">
                    <p className="truncate" title={leadCourseText(lead)}>
                      {leadCourseText(lead)}
                    </p>
                  </TableCell>
                  <TableCell className="px-3">
                    <Badge variant={lead.caslConsent ? "tag" : "outline"}>{lead.caslConsent ? "Yes" : "No"}</Badge>
                  </TableCell>
                  <TableCell className="px-3 text-xs text-muted-foreground">{dateText(lead.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager page={page} maxPage={maxPage} onPage={setPage} />
      </CardContent>
    </Card>
  )
}

export function FormsLeadsTab({ courses, leadsByKind }: { courses: string[]; leadsByKind: SiteKeyCount[] }) {
  const [kind, setKind] = useState<"all" | SiteLeadKind>("all")
  const [course, setCourse] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<SiteLead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    listSiteLeads({
      kind: kind === "all" ? undefined : kind,
      course: cleanCourse(course) || undefined,
      q: query || undefined,
      limit: LIMIT,
      offset: page * LIMIT,
    })
      .then((res) => {
        if (cancelled) return
        setTotal(res.total)
        setItems(res.items)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load leads")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, course, query, page])

  const maxPage = pageCount(total)
  const counts = useMemo(() => kindCountMap(leadsByKind), [leadsByKind])

  return (
    <Card className="bg-white">
      <CardHeader className="space-y-3">
        <CardTitle>All forms</CardTitle>
        <div className="space-y-3">
          <ToggleGroup
            value={[kind]}
            onValueChange={(values: string[]) => {
              const next = values.find((value) => value !== kind)
              if (!next) return
              setKind(next as "all" | SiteLeadKind)
              setPage(0)
            }}
            className="rail -mx-1 overflow-x-auto px-1"
          >
            <ToggleGroupItem value="all" className="rounded-full border bg-white px-3 text-xs">
              All <span className="tnum">{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
            </ToggleGroupItem>
            {KIND_ORDER.map((k) => (
              <ToggleGroupItem key={k} value={k} className="rounded-full border bg-white px-3 text-xs">
                {KIND_LABELS[k]} <span className="tnum">{counts[k] ?? 0}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-muted-foreground">
              Course
              <Select className="mt-1 w-44" value={course} onChange={(e) => setCourse(e.target.value)}>
                <option value="">All courses</option>
                {courses.map((slug) => (
                  <option key={slug} value={slug}>
                    {slug}
                  </option>
                ))}
              </Select>
            </label>

            <label className="text-sm text-muted-foreground">
              Search
              <Input className="mt-1 w-64" placeholder="Name, email or company" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>

            {kind === "all" ? (
              <p className="text-xs text-muted-foreground">Pick one kind to copy emails.</p>
            ) : (
              <CopyEmailsButton kind={kind} course={course || undefined} />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No form leads found.</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Type</TableHead>
                <TableHead className="px-3">Lead</TableHead>
                <TableHead className="px-3">Course / Company</TableHead>
                <TableHead className="px-3">Message</TableHead>
                <TableHead className="px-3">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="px-3">
                    <Badge variant="secondary">{KIND_LABELS[lead.kind]}</Badge>
                  </TableCell>
                  <TableCell className="max-w-0 min-w-56 px-3">
                    <p className="truncate text-heading" title={lead.name || lead.email}>
                      {lead.name || "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={lead.email}>
                      {lead.email}
                    </p>
                    {lead.phone && (
                      <p className="truncate text-xs text-muted-foreground">
                        <a href={`tel:${lead.phone}`} className="underline underline-offset-4">
                          {lead.phone}
                        </a>
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-0 px-3">
                    {lead.kind === "firms" ? (
                      <>
                        <p className="truncate" title={lead.companyName || "—"}>
                          {lead.companyName || "—"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">Team: {lead.teamSize || "—"}</p>
                      </>
                    ) : (
                      <p className="truncate" title={leadCourseText(lead)}>
                        {leadCourseText(lead)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-0 px-3">
                    <p className="line-clamp-2 text-xs text-muted-foreground" title={lead.message || ""}>
                      {lead.message || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="px-3 text-xs text-muted-foreground">{dateText(lead.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pager page={page} maxPage={maxPage} onPage={setPage} />
      </CardContent>
    </Card>
  )
}

function Pager({ page, maxPage, onPage }: { page: number; maxPage: number; onPage: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Page {page + 1} of {maxPage}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={page <= 0} onClick={() => onPage(Math.max(0, page - 1))}>
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page + 1 >= maxPage}
          onClick={() => onPage(Math.min(maxPage - 1, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
