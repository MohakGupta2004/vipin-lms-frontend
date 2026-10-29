"use client"

import { ArrowClockwiseIcon, ArrowRightIcon, CheckCircleIcon, CircleNotchIcon, CloudArrowUpIcon, FilmStripIcon, PencilSimpleIcon, PlayCircleIcon, PlusIcon, TrashIcon, WarningIcon, XIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { ErrorNote, errMsg } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { LockHint, LockedRow, TierBadge } from "@/components/tier-badge"
import { TierPicker } from "@/components/tier-picker"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  ApiError,
  DEFAULT_TIERS,
  VIDEO_EXT_RE,
  VIDEO_KINDS,
  VIDEO_KIND_LABEL,
  confirmVideo,
  deleteVideo,
  getVideo,
  renewVideoUpload,
  requestVideoUpload,
  updateVideo,
  type ContentTier,
  type Tier,
  type Video,
  type VideoKind,
  type VideoUpload,
} from "@/lib/api"
import { acquireConversionSlot, canConvertVideo, probeVideo, transcodeAndUpload, type UploadForm } from "@/lib/video-transcode"
import { MAX_DURATION_SEC } from "@/lib/video-transcode/ladder"

const POLL_MS = 5_000
// Matches the server's limits.
const MAX_TITLE = 255
const MAX_DESCRIPTION = 5000

// waiting: another video is converting in this tab. checking: reading the file. starting: creating the video.
type Phase = "waiting" | "checking" | "starting" | "converting" | "confirming" | "error"

// An upload running in this tab: the browser converts the file to HLS and uploads it, then the server checks it.
type LocalUpload = {
  key: string
  file: File
  kind: VideoKind
  tiers: ContentTier[]
  description: string
  phase: Phase
  progress: number // 0 to 1, of converting
  uploadedBytes: number
  offline?: boolean // uploads are failing; they resume on their own
  error?: string
  upload?: VideoUpload // the server's video and upload form, once created
  uploaded?: boolean // every file is in storage; only confirm is left
}

const formOf = (u: VideoUpload): UploadForm => ({
  url: u.uploadUrl,
  keyPrefix: u.keyPrefix,
  fields: u.fields,
  maxFileBytes: u.maxFileBytes,
  expiresAt: u.expiresAt,
})

const notFound = (e: unknown) => e instanceof ApiError && e.status === 404

export function fmtBytes(n: number) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

/**
 * Owner-only video manager for a lesson, split into Offline Recordings and Meet Recordings. The browser
 * converts each video to a 1080p/720p/480p HLS ladder itself, one at a time, uploads the files straight to
 * storage with a signed form, and confirms; the server checks the files and the video is ready.
 * The section a video sits in is its `kind`.
 */
export function VideoSection({
  lessonId,
  videos,
  setVideos,
  formKind,
  setFormKind,
}: {
  lessonId: string
  videos: Video[]
  setVideos: (fn: (v: Video[]) => Video[]) => void
  /** The section whose upload form is open, if any. */
  formKind: VideoKind | null
  setFormKind: (k: VideoKind | null) => void
}) {
  const [uploads, setUploads] = useState<LocalUpload[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  // The video whose title and description are being edited in place.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctrls = useRef(new Map<string, AbortController>())
  // Video rows this tab created and hasn't finished, by upload key: removed again if the upload is abandoned.
  const rows = useRef(new Map<string, string>())
  // The parent passes a fresh setter each render; the poller must not restart because of it.
  const setVideosRef = useRef(setVideos)
  useEffect(() => {
    setVideosRef.current = setVideos
  })

  const patch = (key: string, p: Partial<LocalUpload>) =>
    setUploads((us) => us.map((u) => (u.key === key ? { ...u, ...p } : u)))

  // Deletes the server's row for an upload that won't finish, with whatever files it had uploaded.
  // keepalive lets the request finish while the tab closes.
  const discard = (key: string) => {
    const videoId = rows.current.get(key)
    if (!videoId) return
    rows.current.delete(key)
    deleteVideo(videoId, true).catch(() => {})
  }

  // Leaving the lesson card stops every conversion (terminating its worker) and cleans up after it.
  useEffect(() => {
    const map = ctrls.current
    const created = rows.current
    return () => {
      map.forEach((c) => c.abort())
      map.clear()
      created.forEach((videoId) => deleteVideo(videoId, true).catch(() => {}))
      created.clear()
    }
  }, [])

  // Closing the tab mid-upload loses the work, so ask first; if it closes anyway, clean up.
  const busy = uploads.some((u) => u.phase !== "error")
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    const leave = (e: PageTransitionEvent) => {
      if (e.persisted) return // kept in the back/forward cache: the page may come back as it was
      ctrls.current.forEach((c) => c.abort())
      rows.current.forEach((_, key) => discard(key))
    }
    window.addEventListener("beforeunload", warn)
    window.addEventListener("pagehide", leave)
    return () => {
      window.removeEventListener("beforeunload", warn)
      window.removeEventListener("pagehide", leave)
    }
  }, [busy])

  // Converting a long video takes a while: keep the screen (and so the machine) awake meanwhile.
  const converting = uploads.some((u) => u.phase === "converting")
  useEffect(() => {
    if (!converting || !("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | null = null
    let released = false
    const acquire = () => {
      if (released || document.visibilityState !== "visible" || (lock && !lock.released)) return
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (released) l.release().catch(() => {})
          else lock = l
        })
        .catch(() => {})
    }
    acquire()
    document.addEventListener("visibilitychange", acquire)
    return () => {
      released = true
      document.removeEventListener("visibilitychange", acquire)
      lock?.release().catch(() => {})
    }
  }, [converting])

  // Poll every video that is transcoding until it settles.
  const pending = videos
    .filter((v) => v.status === "processing")
    .map((v) => v.id)
    .join(",")
  useEffect(() => {
    if (!pending) return
    const ids = pending.split(",")
    let inFlight = false
    const timer = setInterval(async () => {
      if (inFlight) return
      inFlight = true
      const fresh = await Promise.all(
        ids.map((vid) => getVideo(vid).catch(() => null))
      )
      inFlight = false
      setVideosRef.current((vs) =>
        vs.map((v) => fresh.find((f) => f?.id === v.id) ?? v)
      )
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [pending])

  async function run(u: LocalUpload) {
    const ctrl = new AbortController()
    ctrls.current.set(u.key, ctrl)
    const { signal } = ctrl
    let upload = u.upload
    let release: (() => void) | undefined
    const finish = (video: Video) => {
      rows.current.delete(u.key)
      setUploads((us) => us.filter((x) => x.key !== u.key))
      setVideos((vs) => [video, ...vs.filter((v) => v.id !== video.id)])
    }
    try {
      if (!u.uploaded) {
        patch(u.key, { phase: "waiting", error: undefined, progress: 0, uploadedBytes: 0, offline: false })
        release = await acquireConversionSlot(signal)

        patch(u.key, { phase: "checking" })
        // Nothing is created on the server until the file is known to convert here.
        const probe = await probeVideo(u.file, signal)
        if (probe.problems.length > 0) throw new Error(probe.problems.join(" "))

        patch(u.key, { phase: "starting" })
        if (upload) {
          // Another attempt at the same video: it may have finished after all, or been removed meanwhile.
          const current = await getVideo(upload.video.id).catch((e) => {
            if (notFound(e)) return null
            throw e
          })
          if (current?.status === "ready") return finish(current)
          upload = current ? await renewVideoUpload(current.id) : undefined
        }
        if (!upload) {
          upload = await requestVideoUpload(lessonId, {
            fileName: u.file.name,
            description: u.description || undefined,
            kind: u.kind,
            tiers: u.tiers,
          })
        }
        rows.current.set(u.key, upload.video.id)
        if (signal.aborted) return discard(u.key) // cancelled while the video was being created
        patch(u.key, { upload, phase: "converting" })

        const videoId = upload.video.id
        await transcodeAndUpload(u.file, {
          form: formOf(upload),
          renewForm: async () => formOf(await renewVideoUpload(videoId)),
          onProgress: (p) => patch(u.key, { progress: p.progress, uploadedBytes: p.uploadedBytes }),
          onNetwork: (offline) => patch(u.key, { offline }),
          signal,
        })
        release()
        patch(u.key, { uploaded: true })
      }

      if (signal.aborted) return
      patch(u.key, { phase: "confirming", error: undefined, offline: false })
      const videoId = upload!.video.id
      try {
        finish(await confirmVideo(videoId))
      } catch (e) {
        // The server found the files incomplete or wrong: the next attempt converts and uploads again.
        if (e instanceof ApiError && e.status === 400) patch(u.key, { uploaded: false })
        throw e
      }
    } catch (e) {
      if (signal.aborted) return
      patch(u.key, { phase: "error", offline: false, error: errMsg(e) })
    } finally {
      release?.()
      if (ctrls.current.get(u.key) === ctrl) ctrls.current.delete(u.key)
    }
  }

  function start(file: File, kind: VideoKind, tiers: ContentTier[], description: string) {
    const u: LocalUpload = {
      key: crypto.randomUUID(),
      file,
      kind,
      tiers,
      description,
      phase: "waiting",
      progress: 0,
      uploadedBytes: 0,
    }
    setUploads((us) => [u, ...us])
    setFormKind(null)
    run(u)
  }

  function cancel(u: LocalUpload) {
    if (u.phase !== "error" && !confirm(`Cancel uploading "${u.file.name}"?`))
      return
    ctrls.current.get(u.key)?.abort()
    discard(u.key)
    setUploads((us) => us.filter((x) => x.key !== u.key))
  }

  async function remove(v: Video) {
    if (!confirm(`Delete "${v.title}"? Students lose it and their progress on it. This can't be undone.`)) return
    setError(null)
    setDeleting(v.id)
    try {
      await deleteVideo(v.id)
      setVideos((vs) => vs.filter((x) => x.id !== v.id))
      if (editingId === v.id) setEditingId(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section className="space-y-5 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-7 md:space-y-0">
      {error && (
        <div className="md:col-span-2">
          <ErrorNote error={error} />
        </div>
      )}
      {VIDEO_KINDS.map((kind) => {
        const kindVideos = videos.filter((v) => v.kind === kind)
        const kindUploads = uploads.filter((u) => u.kind === kind)
        const formOpen = formKind === kind
        // Desktop: each kind is a panel; one that is being edited or uploaded to takes the full width.
        const wide = formOpen || kindVideos.some((v) => v.id === editingId)
        const uploadLabel = `Upload ${kind === "meet" ? "Meet recording" : "offline recording"}`
        return (
          <div key={kind} className={"space-y-3 md:space-y-2 md:self-start " + (wide ? "md:col-span-2" : "")}>
            <div className="flex items-center justify-between gap-3 md:px-1">
              <h3 className="flex items-center gap-2 text-sm font-medium text-heading md:gap-1.5 md:text-[13px] md:font-semibold md:text-heading/75">
                <FilmStripIcon className="size-4 text-teal md:hidden" />
                {VIDEO_KIND_LABEL[kind]}
                {kindVideos.length > 0 && <span className="tnum hidden font-normal text-heading/35 md:inline">{kindVideos.length}</span>}
              </h3>
            </div>
            {/* Flex gap skips the desktop-only add row, so phone spacing is unchanged. */}
            <div className="inset-box flex flex-col gap-3 md:gap-0">
            {kindVideos.length === 0 && kindUploads.length === 0 && !formOpen && (
              <p className="rounded-md border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-muted-foreground">
                No {VIDEO_KIND_LABEL[kind].toLowerCase()} uploaded yet.
              </p>
            )}

            <ul className="space-y-2 md:empty:hidden">
              {kindUploads.map((u) => (
                <UploadRow
                  key={u.key}
                  u={u}
                  onRetry={() => run(u)}
                  onCancel={() => cancel(u)}
                />
              ))}
              {kindVideos.map((v) =>
                editingId === v.id ? (
                  <li key={v.id}>
                    <VideoDetailsForm
                      video={v}
                      onSaved={(next) => {
                        // Keep the live status: the poller may have moved it on while the form was open.
                        setVideos((vs) =>
                          vs.map((x) =>
                            x.id === v.id
                              ? { ...x, title: next.title, description: next.description, kind: next.kind, tiers: next.tiers, isFree: next.isFree }
                              : x
                          )
                        )
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <VideoRow
                    key={v.id}
                    v={v}
                    onEdit={() => setEditingId(v.id)}
                    deleting={deleting === v.id}
                    onDelete={() => remove(v)}
                  />
                )
              )}
            </ul>
            {!formOpen && (
              <button type="button" className="inset-add" onClick={() => setFormKind(kind)}>
                <PlusIcon weight="bold" /> {uploadLabel}
              </button>
            )}
            </div>

            {!formOpen && (
              <Button variant="outline" size="sm" onClick={() => setFormKind(kind)} className="md:hidden">
                <CloudArrowUpIcon /> {uploadLabel}
              </Button>
            )}
            {formOpen && (
              <VideoUploadForm
                lessonId={lessonId}
                kind={kind}
                onStart={start}
                onClose={() => setFormKind(null)}
              />
            )}
          </div>
        )
      })}
    </section>
  )
}

function RowShell({
  tone,
  title,
  meta,
  chip,
  bar,
  children,
}: {
  tone: "teal" | "lime" | "red" | "gray"
  title: string
  meta: React.ReactNode
  chip: React.ReactNode
  bar?: React.ReactNode
  children?: React.ReactNode
}) {
  const tile = {
    teal: "bg-mint text-teal",
    lime: "bg-lime-soft text-navy",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-100 text-gray-500",
  }[tone]
  return (
    // Title first and in full, status and size under it; on phones the actions get their own row so nothing is squeezed.
    <li className="pop relative touch-manipulation rounded-md border border-border bg-white p-3 transition-[border-color,transform] duration-150 hover:border-teal/40 has-[.tap-link:active]:scale-[0.985]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={
            "flex size-10 shrink-0 items-center justify-center rounded-md " +
            tile
          }
        >
          <FilmStripIcon className="size-5" />
        </span>
        <span className="min-w-0 flex-1 basis-40 space-y-1">
          <span className="line-clamp-2 block text-sm font-semibold break-words text-heading">
            {title}
          </span>
          <span className="tnum flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {chip}
            {meta}
          </span>
        </span>
        {children && (
          <span className="flex shrink-0 items-center justify-end gap-1 max-sm:w-full max-sm:border-t max-sm:border-border max-sm:pt-2">
            {children}
          </span>
        )}
      </div>
      {bar}
    </li>
  )
}

function Chip({
  className,
  children,
}: {
  className: string
  children: React.ReactNode
}) {
  return (
    <span
      className={
        "tnum inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        className
      }
    >
      {children}
    </span>
  )
}

function Bar({ pct }: { pct?: number }) {
  return (
    <div
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct === undefined ? undefined : Math.round(pct)}
    >
      {pct === undefined ? (
        <div className="indeterminate h-full w-2/5 rounded-full bg-teal/60" />
      ) : (
        <div
          className="h-full rounded-full bg-teal transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  )
}

function UploadRow({
  u,
  onRetry,
  onCancel,
}: {
  u: LocalUpload
  onRetry: () => void
  onCancel: () => void
}) {
  const pct = Math.min(100, u.progress * 100)
  const failed = u.phase === "error"
  const label = {
    waiting: "Waiting…",
    checking: "Preparing…",
    starting: "Preparing…",
    converting: `${Math.floor(pct)}%`,
    confirming: "Verifying…",
    error: "Upload failed",
  }[u.phase]

  return (
    <RowShell
      tone={failed ? "red" : "teal"}
      title={u.file.name}
      meta={
        <>
          {u.phase === "waiting"
            ? "Starts when the video before it is done"
            : u.phase === "converting"
              ? u.offline
                ? "Connection lost, resumes on its own"
                : `Converting and uploading · ${fmtBytes(u.uploadedBytes)} sent`
              : fmtBytes(u.file.size)}
          <TierBadge tags={u.tiers} />
        </>
      }
      chip={
        <Chip
          className={failed ? "bg-red-50 text-red-700" : "bg-mint text-teal"}
        >
          {failed ? (
            <WarningIcon className="size-3.5" />
          ) : (
            <CircleNotchIcon className="size-3.5 animate-spin" />
          )}
          {label}
        </Chip>
      }
      bar={
        failed ? (
          <p className="mt-2 text-xs text-red-700">{u.error}</p>
        ) : (
          <Bar pct={u.phase === "converting" ? pct : undefined} />
        )
      }
    >
      {failed && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <ArrowClockwiseIcon /> Retry
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Cancel ${u.file.name}`}
        className="hover:bg-destructive/10 hover:text-destructive"
        onClick={onCancel}
      >
        <XIcon />
      </Button>
    </RowShell>
  )
}

function VideoRow({
  v,
  onEdit,
  deleting,
  onDelete,
}: {
  v: Video
  onEdit: () => void
  deleting: boolean
  onDelete: () => void
}) {
  const meta = (
    <>
      {v.sizeBytes > 0 && <span>{fmtBytes(v.sizeBytes)}</span>}
      <TierBadge tags={v.tiers} />
      {!v.description && <span>No description</span>}
    </>
  )
  const edit = (
    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${v.title}`} onClick={onEdit} className="relative z-10">
      <PencilSimpleIcon />
    </Button>
  )
  // Not offered while processing: the server refuses until transcoding has finished or failed.
  const del = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Delete ${v.title}`}
      disabled={deleting}
      onClick={onDelete}
      className="relative z-10 hover:bg-destructive/10 hover:text-destructive"
    >
      {deleting ? <CircleNotchIcon className="animate-spin" /> : <TrashIcon />}
    </Button>
  )

  switch (v.status) {
    case "ready":
      return (
        <RowShell
          tone="teal"
          title={v.title}
          meta={meta}
          chip={
            <Chip className="bg-teal text-white">
              <CheckCircleIcon className="size-3.5" /> Ready
            </Chip>
          }
        >
          <Link
            href={`/courses/${v.courseId}/learn?v=${v.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "tap-link after:absolute after:inset-0 after:rounded-md")}
          >
            <PlayCircleIcon /> Play
          </Link>
          {edit}
          {del}
        </RowShell>
      )
    case "processing":
      return (
        <RowShell
          tone="lime"
          title={v.title}
          meta={
            <>
              {meta}
              <span>
                · Transcoding for streaming, this can take a few minutes
              </span>
            </>
          }
          chip={
            <Chip className="bg-lime-soft text-navy">
              <CircleNotchIcon className="size-3.5 animate-spin" /> Processing
            </Chip>
          }
          bar={<Bar />}
        >
          {edit}
        </RowShell>
      )
    case "failed":
      return (
        <RowShell
          tone="red"
          title={v.title}
          meta={meta}
          chip={
            <Chip className="bg-red-50 text-red-700">
              <WarningIcon className="size-3.5" /> Failed
            </Chip>
          }
          bar={
            <p className="mt-2 text-xs text-red-700">
              {v.error || "Transcoding failed. Delete this video and upload it again."}
            </p>
          }
        >
          {edit}
          {del}
        </RowShell>
      )
    default:
      // 'uploading' on the server but not in this tab: the browser left before the file finished.
      return (
        <RowShell
          tone="gray"
          title={v.title}
          meta={
            <span>The upload didn&apos;t finish. Upload the file again.</span>
          }
          chip={<Chip className="bg-gray-100 text-gray-600">Incomplete</Chip>}
        >
          {del}
        </RowShell>
      )
  }
}

function VideoUploadForm({
  lessonId,
  kind,
  onStart,
  onClose,
}: {
  lessonId: string
  kind: VideoKind
  onStart: (file: File, kind: VideoKind, tiers: ContentTier[], description: string) => void
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  // Offline recordings start on Premium, Meet recordings on Ultra only. Only videos tagged Free play
  // without enrolling, even in a free lesson.
  const [tiers, setTiers] = useState<ContentTier[]>(DEFAULT_TIERS[kind])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pick(f: File | undefined) {
    setError(null)
    if (!f) return
    if (!VIDEO_EXT_RE.test(f.name))
      return setError("Only .mp4, .mov, .mkv or .webm videos are allowed.")
    if (f.size === 0) return setError("That file is empty.")
    // The browser converts the video itself, so it must be able to.
    if (!canConvertVideo())
      return setError("This browser can't convert video. Use the latest Chrome, Edge or Safari.")
    setFile(f)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return setError("Choose a video file.")
    onStart(file, kind, tiers, description.trim())
  }

  const inputId = `vf-${lessonId}-${kind}`

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-border bg-white p-5 shadow-sm"
    >
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          pick(e.dataTransfer.files[0])
        }}
        className={
          "flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors duration-200 " +
          (dragging
            ? "border-teal bg-mint/60"
            : "border-border hover:border-teal/50 hover:bg-gray-50")
        }
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          {file ? (
            <FilmStripIcon className="size-5" />
          ) : (
            <CloudArrowUpIcon className="size-5" />
          )}
        </span>
        {file ? (
          <>
            <span className="max-w-full truncate text-sm font-semibold text-heading">
              {file.name}
            </span>
            <span className="tnum text-xs text-muted-foreground">
              {fmtBytes(file.size)} · click to change
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-heading">
              Drop a video here, or click to browse
            </span>
            <span className="text-xs text-muted-foreground">
              MP4, MOV, MKV or WebM · up to {MAX_DURATION_SEC / 3600} hours
            </span>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      <Field>
        <FieldLabel htmlFor={`vd-${lessonId}-${kind}`}>Description (optional)</FieldLabel>
        <Textarea
          id={`vd-${lessonId}-${kind}`}
          rows={3}
          maxLength={MAX_DESCRIPTION}
          placeholder="What this lecture covers. Students see it under the video."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <TierPicker value={tiers} onChange={setTiers} />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={!file} className="max-sm:flex-1">
          <CloudArrowUpIcon /> Start upload
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/** Edits an uploaded video's title, description, who can watch it, and which section it sits in. */
function VideoDetailsForm({
  video,
  onSaved,
  onCancel,
}: {
  video: Video
  onSaved: (v: Video) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(video.title)
  const [description, setDescription] = useState(video.description)
  const [kind, setKind] = useState<VideoKind>(video.kind)
  const [tiers, setTiers] = useState<ContentTier[]>(video.tiers)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      onSaved(await updateVideo(video.id, { title: title.trim(), description: description.trim(), kind, tiers }))
    } catch (err) {
      setError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-white p-5 shadow-sm">
      <Field>
        <FieldLabel htmlFor={`vt-${video.id}`}>Title</FieldLabel>
        <Input
          id={`vt-${video.id}`}
          required
          maxLength={MAX_TITLE}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`vd-${video.id}`}>Description (optional)</FieldLabel>
        <Textarea
          id={`vd-${video.id}`}
          rows={4}
          maxLength={MAX_DESCRIPTION}
          placeholder="What this lecture covers. Students see it under the video."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`vk-${video.id}`}>Section</FieldLabel>
        <Select id={`vk-${video.id}`} value={kind} onChange={(e) => setKind(e.target.value as VideoKind)}>
          {VIDEO_KINDS.map((k) => (
            <option key={k} value={k}>
              {VIDEO_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>
      <TierPicker value={tiers} onChange={setTiers} />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="max-sm:flex-1">
          {saving && <CircleNotchIcon className="animate-spin" />}
          Save video
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/**
 * Read-only lecture list for students, grouped into Offline Recordings and Meet Recordings (an empty group is
 * hidden). Each row opens the player. Locked rows (not enrolled, or on a lower tier) only show the title and
 * why they are closed; `tier` is the student's tier in the course.
 */
export function VideoList({ videos, tier, linkQuery }: { videos: Video[]; tier?: Tier; linkQuery?: string }) {
  const ready = videos.filter((v) => v.status === "ready")
  if (ready.length === 0) return null
  return (
    <>
      {VIDEO_KINDS.map((kind) => {
        const group = ready.filter((v) => v.kind === kind)
        if (group.length === 0) return null
        return (
          <section key={kind} className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-heading">
              <FilmStripIcon className="size-4 text-teal" /> {VIDEO_KIND_LABEL[kind]}
            </h3>
            <ul className="space-y-2">
              {group.map((v) => (
                v.locked ? (
                  <LockedRow
                    key={v.id}
                    title={v.title}
                    meta="Video lecture"
                    hint={<LockHint courseTier={tier} tags={v.tiers} />}
                  />
                ) : (
                  <li key={v.id}>
                    <Link
                      href={`/courses/${v.courseId}/learn?v=${v.id}${linkQuery ? `&${linkQuery}` : ""}`}
                      className="tap group/row flex items-center gap-3 rounded-md border border-border bg-white p-3 hover:border-teal/40 hover:shadow-sm active:border-teal/40"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors group-hover/row:bg-teal group-hover/row:text-white">
                        <PlayCircleIcon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-semibold break-words text-heading">
                          {v.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Video lecture
                        </span>
                      </span>
                      {v.tiers.includes("free") && <Badge variant="lime">Preview</Badge>}
                      <ArrowRightIcon className="size-4 shrink-0 text-heading/50 transition-transform duration-200 group-hover/row:translate-x-1" />
                    </Link>
                  </li>
                )
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
