"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { AppShell, PageTitle } from "@/components/app-shell"
import { FormsLeadsTab, MasterclassLeadsTab } from "@/components/website/leads-table"
import { WebsiteOverview } from "@/components/website/overview"
import { VisitorsTab } from "@/components/website/visitors-table"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSiteOverview, type SiteLeadKind, type SiteOverview } from "@/lib/api"

type WebsiteTab = "overview" | "masterclass" | "forms" | "visitors"

/** The tab the URL asks for; anything unknown opens the overview. */
function readTab(value: string | null): WebsiteTab {
  if (value === "masterclass" || value === "forms" || value === "visitors") return value
  return "overview"
}

function normalizeCourses(items: { key: string }[]) {
  const out: string[] = []
  for (const item of items) {
    const value = item.key.trim()
    if (!value) continue
    if (!out.includes(value)) out.push(value)
  }
  return out
}

function emptyOverview(days: number): SiteOverview {
  return {
    days,
    uniqueVisitors: 0,
    newVisitors: 0,
    returningVisitors: 0,
    pageviews: 0,
    anonymousPageviews: 0,
    leads: 0,
    leadsByKind: [],
    leadsByCourse: [],
    masterclassByCourse: [],
    daily: [],
    devices: [],
    browsers: [],
    countries: [],
    referrers: [],
    topPages: [],
  }
}

export default function WebsitePage() {
  return (
    <AppShell roles={["admin"]}>
      <Suspense>
        <WebsiteInner />
      </Suspense>
    </AppShell>
  )
}

function WebsiteInner() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // The tab lives in the URL, so a link to it opens the right one.
  const tab = readTab(params.get("tab"))
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<SiteOverview>(() => emptyOverview(30))

  function onTab(value: string) {
    const next = new URLSearchParams(params)
    next.set("tab", value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    getSiteOverview(days)
      .then((res) => {
        if (cancelled) return
        setOverview(res)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load website overview")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [days])

  const masterclassCourses = useMemo(() => {
    const pool = [...overview.masterclassByCourse, ...overview.leadsByCourse]
    return normalizeCourses(pool)
  }, [overview.leadsByCourse, overview.masterclassByCourse])

  const formCourses = useMemo(() => normalizeCourses(overview.leadsByCourse), [overview.leadsByCourse])

  const leadKinds = useMemo(() => {
    return overview.leadsByKind.filter((item) => isLeadKind(item.key))
  }, [overview.leadsByKind])

  return (
    <div className="space-y-6">
      <PageTitle title="Website" subtitle="Track traffic, leads and visitor journeys from the public website." />

      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={onTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="masterclass">Masterclass</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <WebsiteOverview days={days} onDays={setDays} overview={overview} />}
        </TabsContent>

        <TabsContent value="masterclass">
          <MasterclassLeadsTab courses={masterclassCourses} />
        </TabsContent>

        <TabsContent value="forms">
          <FormsLeadsTab courses={formCourses} leadsByKind={leadKinds} />
        </TabsContent>

        <TabsContent value="visitors">
          <VisitorsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function isLeadKind(value: string): value is SiteLeadKind {
  return (
    value === "masterclass" ||
    value === "diagnostic" ||
    value === "contact" ||
    value === "firms" ||
    value === "newsletter" ||
    value === "interest"
  )
}
