"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { getSiteLeadEmails, type SiteLeadKind } from "@/lib/api"

const GMAIL_MAX_URL = 8_000

function buildGmailLink(emails: string[]) {
  const bcc = emails.join(",")
  const href = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bcc)}`
  if (href.length >= GMAIL_MAX_URL) return null
  return href
}

export function CopyEmailsButton({ kind, course, disabled }: { kind: SiteLeadKind; course?: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emails, setEmails] = useState<string[] | null>(null)
  const [copied, setCopied] = useState<number | null>(null)

  const gmailHref = useMemo(() => {
    if (!emails || emails.length === 0) return null
    return buildGmailLink(emails)
  }, [emails])

  async function onCopy() {
    setLoading(true)
    setError(null)
    setCopied(null)
    try {
      const res = await getSiteLeadEmails(kind, course || undefined)
      setEmails(res.emails)
      const joined = res.emails.join(",")
      await navigator.clipboard.writeText(joined)
      setCopied(res.count)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy emails")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onCopy} disabled={disabled || loading}>
        {loading ? "Copying…" : "Copy all emails"}
      </Button>
      {gmailHref && (
        <a href={gmailHref} target="_blank" rel="noreferrer" className="text-sm font-medium text-teal underline underline-offset-4">
          Open in Gmail
        </a>
      )}
      {copied !== null && <p className="text-xs text-muted-foreground">Copied {copied} emails</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
