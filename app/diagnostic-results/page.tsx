"use client"

import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  listDiagnosticResults,
  type DiagnosticResultElement,
  type DiagnosticResultList,
} from "@/lib/api"
import { DIAGNOSTIC_ELEMENTS } from "@/lib/diagnostic-questions"
import { elementScorePercent } from "@/lib/diagnostic-score"

const LIMIT = 25

export default function DiagnosticResultsPage() {
  return (
    <AppShell roles={["admin"]}>
      <DiagnosticResults />
    </AppShell>
  )
}

function DiagnosticResults() {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [data, setData] = useState<DiagnosticResultList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    listDiagnosticResults({
      limit: LIMIT,
      offset: page * LIMIT,
      q: appliedQuery || undefined,
    })
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch((e) => {
        if (cancelled) return
        setError(errMsg(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, appliedQuery])

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / LIMIT))

  function search() {
    setPage(0)
    setAppliedQuery(query.trim())
  }

  function openResult(id: string) {
    router.push(`/diagnostic-results/${id}`)
  }

  return (
    <>
      <PageTitle
        title="Diagnostic results"
        subtitle="Everyone who has taken the skill diagnostic, with their two strongest elements."
      />

      <ErrorNote error={error} />

      <Card className="bg-white">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search results</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") search()
                }}
                placeholder="Search by name or email"
                className="bg-white pl-9"
              />
            </label>
            <Button variant="outline" onClick={search}>
              Search
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No diagnostic results match.</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3">Name</TableHead>
                  <TableHead className="px-3">Email</TableHead>
                  <TableHead className="px-3">Score</TableHead>
                  <TableHead className="hidden px-3 sm:table-cell">Strongest</TableHead>
                  <TableHead className="px-3">Taken</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const name = `${item.firstName} ${item.lastName}`.trim()
                  const top = topElements(item.elements)

                  return (
                    <TableRow
                      key={item.id}
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() => openResult(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") openResult(item.id)
                      }}
                    >
                      <TableCell className="max-w-0 min-w-32 px-3">
                        <p className="truncate font-medium text-heading" title={name}>
                          {name}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 min-w-44 px-3">
                        <p className="truncate text-xs text-muted-foreground" title={item.email}>
                          {item.email}
                        </p>
                      </TableCell>
                      <TableCell className="tnum px-3 text-heading">
                        {item.correct}/{item.total}
                      </TableCell>
                      <TableCell className="hidden px-3 whitespace-normal sm:table-cell">
                        <p className="max-w-64 text-sm whitespace-normal text-gray-700">
                          {top.map((element) => elementName(element.element)).join(", ")}
                        </p>
                      </TableCell>
                      <TableCell className="px-3 text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
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
              {total > 0 && ` · ${total} results`}
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
    </>
  )
}

function elementName(element: number) {
  const found = DIAGNOSTIC_ELEMENTS[element - 1]
  return found ? found.name : `Element ${element}`
}

function topElements(elements: DiagnosticResultElement[]) {
  const sorted = [...elements]
  sorted.sort((a, b) => {
    const byPercent = elementScorePercent(b) - elementScorePercent(a)
    if (byPercent !== 0) return byPercent
    return b.points - a.points
  })
  return sorted.slice(0, 2)
}
