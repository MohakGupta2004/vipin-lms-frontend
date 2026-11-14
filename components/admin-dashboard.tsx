"use client"

import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { SectionHead } from "@/components/learning"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { KIND_LABELS } from "@/components/website/leads-table"
import { getAdminDashboard, type AdminDashboard, type AdminLead, type PersonLite } from "@/lib/api"

/** The windows the admin can look back over. */
const RANGES = [1, 3, 7]

const DEFAULT_DAYS = 3

/** The admin's home: what changed, and where to go to deal with it. */
export function AdminDashboard() {
  const [days, setDays] = useState(DEFAULT_DAYS)
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getAdminDashboard(days))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return (
    <div className="space-y-8">
      <PageTitle
        title="Dashboard"
        subtitle="What changed in the last few days, and where to look first."
        actions={
          <label className="text-sm text-muted-foreground">
            Last
            <Select
              className="mt-1 w-32"
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Days"
            >
              {RANGES.map((d) => (
                <option key={d} value={String(d)}>
                  {d} {d === 1 ? "day" : "days"}
                </option>
              ))}
            </Select>
          </label>
        }
      />

      <ErrorNote error={error} />

      {loading && !data && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="New sign-ups"
              count={data.newSignups}
              hint={`Signed up in the last ${days} days`}
              href={`/students?view=new&days=${days}`}
            />
            <StatCard
              label="Never logged in"
              count={data.neverLoggedIn}
              hint={`Signed up in the last ${days} days, never logged in`}
              href="/students?view=never_logged_in"
            />
            <StatCard
              label="Logged in, not enrolled"
              count={data.notEnrolled}
              hint="Logged in, but have no course yet"
              href="/students?view=not_enrolled"
            />
            <StatCard
              label="New enrollments"
              count={data.recentEnrollments}
              hint={`Joined a course in the last ${days} days`}
              href={`/students?view=recently_enrolled&days=${days}`}
            />
            <StatCard
              label="Expiring in 7 days"
              count={data.expiringSoon}
              hint="Ends within a week"
              href="/enrollments"
            />
            <StatCard
              label="Masterclass seats"
              count={data.newMasterclassSeats}
              hint={`Taken in the last ${days} days`}
              href="/website?tab=masterclass"
            />
            <StatCard
              label="Form leads"
              count={data.newFormLeads}
              hint={`From the website forms in the last ${days} days`}
              href="/website?tab=forms"
            />
            <StatCard
              label="New website visitors"
              count={data.newVisitors}
              hint={`First seen in the last ${days} days`}
              href="/website?tab=visitors"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <TotalCard label="Students" value={data.totalStudents} />
            <TotalCard label="Courses" value={data.totalCourses} />
            <TotalCard label="Published" value={data.publishedCourses} />
          </div>

          <section className="space-y-4">
            <SectionHead
              title="Latest sign-ups"
              aside={
                <Link
                  href="/students?view=new"
                  className="-m-2 inline-flex items-center gap-1 p-2 font-semibold text-primary hover:underline"
                >
                  See all <ArrowRightIcon weight="bold" className="size-3.5" />
                </Link>
              }
            />
            {data.recentSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sign-ups yet.</p>
            ) : (
              <Card className="gap-0 overflow-hidden py-0">
                <ul className="divide-y divide-border">
                  {data.recentSignups.map((s) => (
                    <SignupRow key={s.id} person={s} />
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section className="space-y-4">
            <SectionHead
              title="Latest website leads"
              aside={
                <Link
                  href="/website?tab=forms"
                  className="-m-2 inline-flex items-center gap-1 p-2 font-semibold text-primary hover:underline"
                >
                  See all <ArrowRightIcon weight="bold" className="size-3.5" />
                </Link>
              }
            />
            {data.recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads yet.</p>
            ) : (
              <Card className="gap-0 overflow-hidden py-0">
                <ul className="divide-y divide-border">
                  {data.recentLeads.map((l) => (
                    <LeadRow key={l.id} lead={l} />
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/** One number to look at; the whole card opens the page behind it. */
function StatCard({ label, count, hint, href }: { label: string; count: number; hint: string; href: string }) {
  return (
    <Link href={href} className="block">
      <Card className="h-full gap-1.5 py-3 transition-colors duration-150 hover:bg-muted/60 sm:py-4">
        <div className="flex items-start justify-between gap-1 px-3 sm:px-4">
          <p className="text-[12px] leading-snug text-muted-foreground sm:text-[13px]">{label}</p>
          {/* A count worth looking at carries a quiet dot, so it stands out from a row of zeros. */}
          {count > 0 && <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="display tnum px-3 text-[1.5rem] leading-none text-heading sm:px-4 sm:text-[2rem]">{count}</p>
        <p className="px-3 text-[11px] leading-snug text-gray-400 sm:px-4 sm:text-xs">{hint}</p>
      </Card>
    </Link>
  )
}

/** One of the totals every admin wants at a glance. */
function TotalCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1.5 py-3 sm:py-4">
      <p className="px-3 text-[12px] text-muted-foreground sm:px-4 sm:text-[13px]">{label}</p>
      <p className="display tnum px-3 text-[1.25rem] leading-none text-heading sm:px-4 sm:text-[1.5rem]">{value}</p>
    </Card>
  )
}

function SignupRow({ person }: { person: PersonLite }) {
  return (
    <li>
      <Link
        href="/students?view=new"
        className="flex flex-col gap-1 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-heading">
            {person.firstName} {person.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{person.email}</p>
        </div>
        <time dateTime={person.createdAt} className="shrink-0 text-xs text-muted-foreground">
          {shortDate(person.createdAt)}
        </time>
      </Link>
    </li>
  )
}

function LeadRow({ lead }: { lead: AdminLead }) {
  const courses = lead.courseSlugs.join(", ")
  return (
    <li>
      <Link
        href="/website?tab=forms"
        className="flex flex-col gap-1.5 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-heading">{lead.name || lead.email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {lead.email}
            {courses && ` · ${courses}`}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Badge variant="secondary">{KIND_LABELS[lead.kind] ?? lead.kind}</Badge>
          <time dateTime={lead.createdAt} className="shrink-0 text-xs text-muted-foreground">
            {shortDate(lead.createdAt)}
          </time>
        </div>
      </Link>
    </li>
  )
}

/** "Nov 14, 12:34" — short enough for a phone, long enough to place the day. */
function shortDate(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
  return `${date}, ${time}`
}
