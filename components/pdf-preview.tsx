"use client"

import { CircleNotchIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, PrinterIcon, XIcon } from "@phosphor-icons/react/dist/ssr"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy

const PRINT_PAGE_WIDTH = 1240

/**
 * Read-only PDF viewer rendered to canvases inside the app.
 * There is no browser PDF toolbar, no file URL and no download control.
 * The Print button prints the pages as images. (A page the user can see can always be screenshotted or
 * saved as a PDF from the print dialog; this removes the easy paths.)
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
  // Page 1's shape, so pages not drawn yet hold their real size and nothing jumps as they arrive.
  const [shape, setShape] = useState(1.294)
  // The bars step aside while reading, as in Quick Look: scrolling down hides them; scrolling up, reaching
  // the end, or a tap on the page brings them back. While they are away a small pill keeps the page count.
  const [bars, setBars] = useState(true)
  const [scrolling, setScrolling] = useState(false)
  const lastY = useRef(0)
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [preparingPrint, setPreparingPrint] = useState(false)
  const [printImages, setPrintImages] = useState<string[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  // Closing plays the sheet back down first; the parent unmounts it once it is off screen.
  const [closing, setClosing] = useState(false)

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
        const first = (await doc.getPage(1)).getViewport({ scale: 1 })
        if (cancelled) return
        setShape(first.height / first.width)
        setPdf(doc)
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
    if (printImages.length === 0) return
    const clearImages = () => setPrintImages([])
    window.addEventListener("afterprint", clearImages)
    // Short wait so the images are in the page before the print dialog opens.
    const timer = setTimeout(() => window.print(), 300)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("afterprint", clearImages)
    }
  }, [printImages])

  async function printNote() {
    if (!pdf) return
    setPreparingPrint(true)
    const images: string[] = []
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        const pdfPage = await pdf.getPage(n)
        const base = pdfPage.getViewport({ scale: 1 })
        const viewport = pdfPage.getViewport({ scale: PRINT_PAGE_WIDTH / base.width })
        const canvas = document.createElement("canvas")
        canvas.width = viewport.width
        canvas.height = viewport.height
        await pdfPage.render({ canvas, viewport }).promise
        images.push(canvas.toDataURL("image/jpeg", 0.9))
      }
      setPrintImages(images)
    } catch {
      setError("This note could not be printed. Please try again.")
    }
    setPreparingPrint(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClosing(true)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") e.preventDefault()
    }
    // Block the context menu page-wide while open, in the capture phase: a touch long-press
    // (phones, or DevTools device mode) also raises it and would offer "Save image".
    const block = (e: Event) => e.preventDefault()
    document.addEventListener("keydown", onKey)
    document.addEventListener("contextmenu", block, true)
    document.addEventListener("dragstart", block, true)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("contextmenu", block, true)
      document.removeEventListener("dragstart", block, true)
      document.body.style.overflow = prev
    }
  }, [])

  // Portal to <body>: an animated ancestor would otherwise become the containing block of this fixed overlay.
  return createPortal(
    <>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${title}`}
      className={cn(
        "pdf-preview fixed inset-0 z-50 bg-[#0b1724] [-webkit-touch-callout:none]",
        closing ? "sheet-out" : "sheet-in"
      )}
      onAnimationEnd={(e) => e.target === e.currentTarget && closing && onClose()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        .pdf-print { display: none; }
        @media print {
          body > *:not(.pdf-print) { display: none !important; }
          .pdf-print { display: block; }
          .pdf-print img { display: block; width: 100%; break-after: page; }
        }
      `}</style>

      {/* The pages scroll the full height of the screen, under a translucent bar at the top and a floating
          zoom capsule at the bottom, as in Quick Look. */}
      <div
        ref={scroller}
        className="absolute inset-0 overflow-auto overscroll-contain px-3 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] select-none sm:px-8"
        onClick={() => setBars((b) => !b)}
        onScroll={(e) => {
          const el = e.currentTarget
          const y = el.scrollTop
          const dy = y - lastY.current
          lastY.current = y
          const atEnd = y + el.clientHeight >= el.scrollHeight - 4
          // A few pixels of slack, so a resting thumb's jitter doesn't flicker the bars.
          if (y < 24 || atEnd || dy < -6) setBars(true)
          else if (dy > 6) setBars(false)
          setScrolling(true)
          clearTimeout(idle.current)
          idle.current = setTimeout(() => setScrolling(false), 900)
          const pages = Array.from(el.querySelectorAll<HTMLElement>("[data-page]"))
          const mid = el.getBoundingClientRect().top + el.clientHeight / 3
          const cur = pages.findLast((p) => p.getBoundingClientRect().top <= mid)
          if (cur) setPage(Number(cur.dataset.page))
        }}
      >
        {!pdf && !error && (
          <div className="flex h-full items-center justify-center gap-2 text-[15px] text-white/70">
            <CircleNotchIcon className="size-5 animate-spin" /> Loading note…
          </div>
        )}
        {error && <div className="flex h-full items-center justify-center px-6 text-center text-[15px] text-white/70">{error}</div>}
        {pdf && (
          <div
            className="mx-auto flex flex-col items-center gap-3 sm:gap-6"
            // 100% is the page fitted to the screen (at most 860px); zooming scales from there, so on a phone
            // it widens past the edges and the pages pan sideways.
            style={{ width: `calc(min(860px, 100%) * ${zoom})` }}
          >
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage key={i} pdf={pdf} n={i + 1} zoom={zoom} shape={shape} />
            ))}
          </div>
        )}
      </div>

      <header
        onFocusCapture={() => setBars(true)}
        className={cn(
          "absolute inset-x-0 top-0 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 border-b border-white/[0.08] bg-[#0b1724]/75 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 transition-transform duration-300 ease-(--ease-drawer) sm:grid-cols-[6rem_1fr_6rem] sm:px-6",
          !bars && "-translate-y-full"
        )}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setClosing(true)}
          className={chrome}
        >
          <XIcon weight="bold" className="size-[18px]" />
        </button>
        <div className="flex h-16 min-w-0 flex-col items-center justify-center text-center">
          <h2 className="w-full truncate text-[15px] font-semibold tracking-[-0.01em] text-white">{title}</h2>
          <p className="tnum h-4 text-[12px] text-white/55">{pdf && `Page ${page} of ${pdf.numPages}`}</p>
        </div>
        <button
          type="button"
          aria-label="Print"
          disabled={!pdf || preparingPrint}
          onClick={printNote}
          className={cn(chrome, "justify-self-end")}
        >
          {preparingPrint ? <CircleNotchIcon className="size-[18px] animate-spin" /> : <PrinterIcon className="size-[18px]" />}
        </button>
      </header>

      {pdf && (
        <div
          aria-hidden="true"
          className={cn(
            "tnum pointer-events-none absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 -translate-x-1/2 rounded-full bg-[#0b1724]/80 px-3 py-1 text-[12px] font-medium text-white/85 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-(--ease-out)",
            !bars && scrolling ? "opacity-100" : "-translate-y-1 opacity-0"
          )}
        >
          {page} / {pdf.numPages}
        </div>
      )}

      {pdf && (
        <div
          onFocusCapture={() => setBars(true)}
          className={cn(
            "absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-center transition-[transform,opacity] duration-300 ease-(--ease-drawer)",
            !bars && "pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0"
          )}
        >
          {/* A dark material, not a light one: it floats over white pages and must stay legible on them. */}
          <div className="flex items-center gap-1 rounded-full bg-[#0b1724]/80 p-1 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.18),0_8px_28px_-6px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= 0.6}
              onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}
              className={zoomBtn}
            >
              <MagnifyingGlassMinusIcon className="size-5" />
            </button>
            {/* The level doubles as "fit": tap it to go back to the page width. */}
            <button
              type="button"
              aria-label="Fit to width"
              onClick={() => setZoom(1)}
              className="tnum h-11 min-w-14 rounded-full px-2 text-[14px] font-medium text-white/85 transition-[background-color,transform] duration-150 active:scale-95 active:bg-white/10"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= 2}
              onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))}
              className={zoomBtn}
            >
              <MagnifyingGlassPlusIcon className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
    <div className="pdf-print">
      {printImages.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" />
      ))}
    </div>
    </>,
    document.body
  )
}

// Round, quiet controls on the dark viewer, answering the press at once.
const chrome =
  "flex size-11 items-center justify-center rounded-full bg-white/[0.1] text-white transition-[background-color,transform,opacity] duration-150 ease-(--ease-out) hover:bg-white/[0.16] active:scale-90 active:bg-white/20 disabled:opacity-40 sm:size-10"
const zoomBtn =
  "flex size-11 items-center justify-center rounded-full text-white transition-[background-color,transform,opacity] duration-150 ease-(--ease-out) active:scale-90 active:bg-white/15 disabled:opacity-35"

function PdfPage({ pdf, n, zoom, shape }: { pdf: PdfDoc; n: number; zoom: number; shape: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(n <= 2)
  const [ratio, setRatio] = useState(shape)
  const [drawn, setDrawn] = useState(false)
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
      if (cancelled || !ref.current) return
      const base = p.getViewport({ scale: 1 })
      setRatio(base.height / base.width)
      const css = 860 * zoom
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = p.getViewport({ scale: (css / base.width) * dpr })
      // Draw off screen, then swap in whole: a zoom re-renders the page without flashing it blank first.
      const off = document.createElement("canvas")
      off.width = vp.width
      off.height = vp.height
      task = p.render({ canvas: off, viewport: vp })
      const ok = await task.promise.then(() => true, () => false)
      const canvas = ref.current
      if (cancelled || !ok || !canvas) return
      canvas.width = off.width
      canvas.height = off.height
      canvas.getContext("2d")?.drawImage(off, 0, 0)
      setDrawn(true)
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, pdf, n, zoom])

  return (
    <div
      ref={wrap}
      data-page={n}
      className="w-full overflow-hidden rounded-[6px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25),0_18px_40px_-12px_rgba(0,0,0,0.55)]"
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      {/* No pointer events: a press or right-click lands on the wrapper, so there is no image to save or drag.
          The page's ink fades up once drawn instead of popping in. */}
      <canvas
        ref={ref}
        className={cn(
          "pointer-events-none block size-full transition-opacity duration-300 ease-(--ease-out)",
          drawn ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}
