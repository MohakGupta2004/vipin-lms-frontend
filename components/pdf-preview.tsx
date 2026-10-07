"use client"

import { Loader2, Minus, Plus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy

/**
 * Read-only PDF viewer rendered to canvases inside the app.
 * There is no browser PDF toolbar, no file URL and no download or print control.
 * (A page the user can see can always be screenshotted; this removes the easy paths.)
 */
export function PdfPreview({
  title,
  load,
  onClose,
}: {
  title: string
  load: () => Promise<Blob>
  onClose: () => void
}) {
  const [pdf, setPdf] = useState<PdfDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [page, setPage] = useState(1)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let task: { destroy: () => Promise<void> } | null = null
    ;(async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
        const data = new Uint8Array(await (await load()).arrayBuffer())
        const loading = pdfjs.getDocument({ data })
        task = loading
        const doc = await loading.promise
        if (!cancelled) setPdf(doc)
      } catch {
        if (!cancelled) setError("This note could not be previewed. Please try again.")
      }
    })()
    return () => {
      cancelled = true
      task?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) e.preventDefault()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Portal to <body>: an animated ancestor would otherwise become the containing block of this fixed overlay.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${title}`}
      className="pdf-preview pop fixed inset-0 z-50 flex flex-col bg-navy"
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`@media print { .pdf-preview { display: none !important; } }`}</style>
      <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/15 px-4 sm:px-6">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-white">{title}</div>
          {pdf && (
            <div className="tnum text-xs text-white/70">
              Page {page} of {pdf.numPages}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outlineLight" size="icon-sm" aria-label="Zoom out" disabled={zoom <= 0.6} onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}>
            <Minus />
          </Button>
          <span className="tnum w-10 text-center text-xs text-white/80">{Math.round(zoom * 100)}%</span>
          <Button variant="outlineLight" size="icon-sm" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))}>
            <Plus />
          </Button>
          <Button variant="lime" size="sm" onClick={onClose} className="ml-2">
            <X /> Close
          </Button>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex-1 overflow-auto p-4 select-none sm:p-8"
        onScroll={(e) => {
          const el = e.currentTarget
          const pages = Array.from(el.querySelectorAll<HTMLElement>("[data-page]"))
          const mid = el.getBoundingClientRect().top + el.clientHeight / 3
          const cur = pages.findLast((p) => p.getBoundingClientRect().top <= mid)
          if (cur) setPage(Number(cur.dataset.page))
        }}
      >
        {!pdf && !error && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-white/80">
            <Loader2 className="size-4 animate-spin" /> Loading preview…
          </div>
        )}
        {error && <div className="flex h-full items-center justify-center text-sm text-white/80">{error}</div>}
        {pdf && (
          <div className="mx-auto flex flex-col items-center gap-4" style={{ width: `min(${Math.round(860 * zoom)}px, ${zoom > 1 ? "none" : "100%"})` }}>
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage key={i} pdf={pdf} n={i + 1} zoom={zoom} />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function PdfPage({ pdf, n, zoom }: { pdf: PdfDoc; n: number; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(n <= 2)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "600px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    let cancelled = false
    ;(async () => {
      const p = await pdf.getPage(n)
      const canvas = ref.current
      if (cancelled || !canvas) return
      const base = p.getViewport({ scale: 1 })
      const css = 860 * zoom
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = p.getViewport({ scale: (css / base.width) * dpr })
      canvas.width = vp.width
      canvas.height = vp.height
      canvas.style.width = "100%"
      task = p.render({ canvas, viewport: vp })
      await task.promise.catch(() => {})
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, pdf, n, zoom])

  return (
    <div ref={wrap} data-page={n} className="w-full rounded-sm bg-white shadow-2xl" style={{ aspectRatio: "1 / 1.294", minHeight: visible ? undefined : 300 }}>
      <canvas ref={ref} className="block h-auto w-full rounded-sm" />
    </div>
  )
}
