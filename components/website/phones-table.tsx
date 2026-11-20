"use client"

import { useEffect, useState } from "react"

import { KIND_LABELS, KIND_ORDER } from "@/components/website/leads-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSiteLeadPhones, type SiteLeadKind, type SiteLeadPhone } from "@/lib/api"

function dateText(iso: string) {
  return new Date(iso).toLocaleString()
}

function CopyPhonesButton({ kind }: { kind?: SiteLeadKind }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)

  async function onCopy() {
    setLoading(true)
    setError(null)
    setCopied(null)
    try {
      const res = await getSiteLeadPhones(kind)
      const joined = res.phones.map((item) => item.phone).join("\n")
      await navigator.clipboard.writeText(joined)
      setCopied(res.count)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy phone numbers")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onCopy} disabled={loading}>
        {loading ? "Copying…" : "Copy all numbers"}
      </Button>
      {copied !== null && <p className="text-xs text-muted-foreground">Copied {copied} phone numbers</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function PhonesTab() {
  const [kind, setKind] = useState<"all" | SiteLeadKind>("all")
  const [items, setItems] = useState<SiteLeadPhone[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    getSiteLeadPhones(kind === "all" ? undefined : kind)
      .then((res) => {
        if (cancelled) return
        setItems(res.phones)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load phone numbers")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind])

  return (
    <Card className="bg-white">
      <CardHeader className="space-y-3">
        <CardTitle>Phone numbers</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-muted-foreground">
            Form
            <Select className="mt-1 w-44" value={kind} onChange={(e) => setKind(e.target.value as "all" | SiteLeadKind)}>
              <option value="all">All forms</option>
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </label>
          <CopyPhonesButton kind={kind === "all" ? undefined : kind} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No phone numbers yet.</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Phone</TableHead>
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">Email</TableHead>
                <TableHead className="px-3">Forms</TableHead>
                <TableHead className="px-3">Leads</TableHead>
                <TableHead className="px-3">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.phone}>
                  <TableCell className="px-3">
                    <a href={`tel:${item.phone}`} className="font-medium text-teal underline underline-offset-4">
                      {item.phone}
                    </a>
                  </TableCell>
                  <TableCell className="max-w-0 min-w-40 px-3">
                    <p className="truncate" title={item.name}>
                      {item.name || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-0 min-w-56 px-3">
                    <p className="truncate" title={item.email}>
                      {item.email || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="px-3">
                    <div className="flex flex-wrap gap-1">
                      {item.kinds.map((k) => (
                        <Badge key={k} variant="secondary">
                          {KIND_LABELS[k] ?? k}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 tnum">{item.leadCount}</TableCell>
                  <TableCell className="px-3 text-xs text-muted-foreground">{dateText(item.lastAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
