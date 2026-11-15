"use client"

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listPeople, TIER_LABEL, type PeopleList, type PeopleView, type Person } from "@/lib/api"
import { joinEmailsForPaste } from "@/lib/emails"

const LIMIT = 50

/** What each view is called, and what it says when it finds nobody. */
const VIEW_TITLE: Record<PeopleView, string> = {
  new: "New sign-ups",
  never_logged_in: "Signed up, never logged in",
  not_enrolled: "Logged in, not enrolled",
  recently_enrolled: "Recently enrolled",
}

const VIEW_EMPTY: Record<PeopleView, string> = {
  new: "No students signed up in this window.",
  never_logged_in: "Every student has logged in at least once.",
  not_enrolled: "Every student has joined a course.",
  recently_enrolled: "No students joined a course in this window.",
}

/** One view of the students, as the admin sees them. */
export function PeopleTable({ view, days }: { view: PeopleView; days: number }) {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<PeopleList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    listPeople({ view, days, limit: LIMIT, offset: page * LIMIT })
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load students")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view, days, page])

  const people = data?.items ?? []
  const total = data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <Card className="bg-white">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{VIEW_TITLE[view]}</CardTitle>
          <CopyEmailsButton people={people} />
        </div>
        {total > 0 && <p className="text-sm text-muted-foreground">{total} students</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-muted-foreground">{VIEW_EMPTY[view]}</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">Email</TableHead>
                <TableHead className="px-3">Phone</TableHead>
                <TableHead className="px-3">Signed up</TableHead>
                <TableHead className="px-3">Last login</TableHead>
                <TableHead className="px-3">Verified</TableHead>
                <TableHead className="px-3">Enrolled courses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {maxPage}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 0}
              onClick={() => setPage(Math.max(0, page - 1))}
            >
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
  )
}

function PersonRow({ person }: { person: Person }) {
  const name = `${person.firstName} ${person.lastName}`.trim()
  return (
    <TableRow>
      <TableCell className="max-w-0 min-w-40 px-3">
        <p className="truncate" title={name}>
          {name}
        </p>
      </TableCell>
      <TableCell className="max-w-0 min-w-56 px-3">
        <p className="truncate" title={person.email}>
          {person.email}
        </p>
      </TableCell>
      <TableCell className="px-3">
        <p className="min-w-28 whitespace-nowrap text-xs text-muted-foreground">{person.phone || "—"}</p>
      </TableCell>
      <TableCell className="px-3 text-xs text-muted-foreground">{dateText(person.createdAt)}</TableCell>
      <TableCell className="px-3 text-xs text-muted-foreground">
        {person.lastLoginAt ? dateText(person.lastLoginAt) : "Never"}
      </TableCell>
      <TableCell className="px-3">
        <Badge variant={person.emailVerified ? "tag" : "outline"}>
          {person.emailVerified ? "Yes" : "No"}
        </Badge>
      </TableCell>
      <TableCell className="min-w-48 px-3">
        {person.enrollments.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-0.5">
            {person.enrollments.map((e) => (
              <li
                key={`${e.courseId}-${e.enrolledAt}`}
                className="line-clamp-2 max-w-[18rem] whitespace-normal text-xs"
                title={`${e.courseTitle} · ${e.instructorName} · ${TIER_LABEL[e.tier]}`}
              >
                {e.courseTitle} · {e.instructorName} · {TIER_LABEL[e.tier]}
              </li>
            ))}
          </ul>
        )}
      </TableCell>
    </TableRow>
  )
}

/** Copies the emails of the list on screen, so they can be pasted into an email. */
function CopyEmailsButton({ people }: { people: Person[] }) {
  const [copied, setCopied] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onCopy() {
    setError(null)
    const emails: string[] = []
    for (const person of people) {
      if (person.email) emails.push(person.email)
    }
    if (emails.length === 0) return
    try {
      await navigator.clipboard.writeText(joinEmailsForPaste(emails))
      setCopied(emails.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy emails")
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onCopy} disabled={people.length === 0}>
        Copy emails
      </Button>
      {copied !== null && <p className="text-xs text-muted-foreground">Copied {copied} emails</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

function dateText(iso: string) {
  return new Date(iso).toLocaleString()
}
