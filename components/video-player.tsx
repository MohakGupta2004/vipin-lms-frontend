"use client"

import type Artplayer from "artplayer"
import type Hls from "hls.js"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { errMsg } from "@/components/app-shell"
import { getVideoStream, saveVideoProgress, setVideoCompletion } from "@/lib/api"
import { qualityLabel } from "@/lib/video-transcode/ladder"

const SAVE_EVERY_MS = 15_000
const REFRESH_BEFORE_MS = 90_000 // re-sign the stream this long before the URL expires
const SKIP_SEC = 10 // a double-tap on either side of the video jumps this far, like YouTube

const PREV_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`
const NEXT_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>`

/**
 * Older videos were transcoded on the server into a 1280×720 (16:9) frame, so a recording made in another shape
 * came out stretched. For those the player draws the picture back at its recorded shape. The lecture recordings
 * are 4:3 (a Mac screen framed by the recorder); any video that still looks off can be switched in the player's
 * settings, remembered per video. Videos converted in the instructor's browser keep their own shape
 * (`nativeAspect`) and are drawn at it, with no setting.
 */
const ASPECTS = [
  { label: "4:3", ratio: 4 / 3 },
  { label: "16:10", ratio: 16 / 10 },
  { label: "16:9", ratio: 16 / 9 },
] as const
const DEFAULT_ASPECT = "4:3"
const aspectKey = (videoId: string) => `video-aspect:${videoId}`

function readAspect(videoId: string): string {
  try {
    const v = localStorage.getItem(aspectKey(videoId))
    if (v && ASPECTS.some((x) => x.label === v)) return v
  } catch {}
  return DEFAULT_ASPECT
}

function saveAspect(videoId: string, label: string) {
  try {
    if (label === DEFAULT_ASPECT) localStorage.removeItem(aspectKey(videoId))
    else localStorage.setItem(aspectKey(videoId), label)
  } catch {}
}

/** Sets the shape the picture is drawn at (see `.stage` in globals.css). */
function applyAspect(a: Artplayer, label: string) {
  const ratio = ASPECTS.find((x) => x.label === label)?.ratio ?? 16 / 9
  a.template.$player.style.setProperty("--ar", String(ratio))
}

/** Draws a video that kept its recorded shape at exactly that shape, once the player knows it. */
function applyNativeAspect(a: Artplayer) {
  const { videoWidth: w, videoHeight: h } = a.video
  if (w > 0 && h > 0) a.template.$player.style.setProperty("--ar", String(w / h))
  else a.template.$player.style.removeProperty("--ar")
}

function removeAspectSetting(a: Artplayer) {
  try {
    a.setting.remove("aspect")
  } catch {} // not there
}

// The server bakes the resume point into the manifest as `start`; we pass it to hls.js instead,
// so a mid-play URL refresh never jumps back to it.
function stripStart(url: string) {
  const u = new URL(url)
  u.searchParams.delete("start")
  return u.toString()
}

/**
 * HLS player (ArtPlayer + hls.js) for one lesson video at a time. Keeps a single player instance
 * across videos so fullscreen survives "next". Resumes where the user stopped, saves progress,
 * and re-signs the stream before its 15-minute URL expires.
 */
export function VideoPlayer({
  videoId,
  title,
  onEnded,
  onPrev,
  onNext,
  overlay,
}: {
  videoId: string
  title: string
  onEnded: () => void
  onPrev?: () => void
  onNext?: () => void
  /** Rendered inside the player (visible in fullscreen too), e.g. an "Up next" card. */
  overlay?: React.ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const art = useRef<Artplayer | null>(null)
  const start = useRef(0) // where the next load should begin
  const ended = useRef(false)
  const refresh = useRef<(() => void) | null>(null)
  const cb = useRef({ onEnded, onPrev, onNext })
  const currentId = useRef(videoId) // the aspect setting saves against whichever video is playing
  const nativeAspect = useRef(false) // the playing video kept its recorded shape
  const [layer, setLayer] = useState<HTMLElement | null>(null)
  // The side a double-tap just skipped on; `n` restarts the flash on every tap.
  const [skip, setSkip] = useState<{ side: "back" | "fwd"; n: number } | null>(null)
  const skipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Keyed by video so switching videos clears it without a reset effect.
  const [failure, setFailure] = useState<{ videoId: string; message: string } | null>(null)
  const error = failure?.videoId === videoId ? failure.message : null

  useEffect(() => {
    cb.current = { onEnded, onPrev, onNext }
    const a = art.current
    if (a?.controls.prev) a.controls.prev.style.display = onPrev ? "" : "none"
    if (a?.controls.next) a.controls.next.style.display = onNext ? "" : "none"
  })

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastSaved = 0
    let lastRefresh = 0
    let detach = () => {}
    ended.current = false
    currentId.current = videoId

    // The "Aspect ratio" entry in settings, showing this video's saved choice.
    const aspectSetting = (label: string) => ({
      name: "aspect",
      html: "Aspect ratio",
      tooltip: label,
      selector: ASPECTS.map((x) => ({ html: x.label, default: x.label === label })),
      onSelect(this: Artplayer, item: { html: string | HTMLElement }) {
        const picked = String(item.html)
        applyAspect(this, picked)
        saveAspect(currentId.current, picked)
        return picked
      },
    })

    const save = (keepalive = false) => {
      const a = art.current
      if (!a || ended.current) return
      const t = a.currentTime
      if (t < 1) return // not started (or resume seek not applied yet): keep the saved position
      // Finished (or nearly): the next visit should start over.
      const pos = a.duration && t >= a.duration - 3 ? 0 : t
      lastSaved = Date.now()
      // The duration lets the server mark the video completed once 90% of it is watched.
      saveVideoProgress(videoId, pos, keepalive, a.duration).catch(() => {})
    }

    const handlers: Record<string, () => void> = {
      "video:timeupdate": () => {
        if (art.current?.playing && Date.now() - lastSaved > SAVE_EVERY_MS) save()
      },
      "video:pause": () => save(),
      "video:play": () => (ended.current = false),
      "video:loadedmetadata": () => {
        if (nativeAspect.current && art.current) applyNativeAspect(art.current)
      },
      "video:resize": () => {
        if (nativeAspect.current && art.current) applyNativeAspect(art.current)
      },
      "video:ended": () => {
        ended.current = true
        saveVideoProgress(videoId, 0, false, art.current?.duration).catch(() => {})
        setVideoCompletion(videoId, true).catch(() => {})
        cb.current.onEnded()
      },
    }

    const schedule = (expiresAt: string) => {
      clearTimeout(timer)
      timer = setTimeout(() => refresh.current?.(), Math.max(5_000, Date.parse(expiresAt) - Date.now() - REFRESH_BEFORE_MS))
    }

    // New signature, same position: switchQuality keeps time and play state.
    refresh.current = async () => {
      if (Date.now() - lastRefresh < 10_000) return
      lastRefresh = Date.now()
      try {
        const s = await getVideoStream(videoId)
        const a = art.current
        if (cancelled || !a) return
        start.current = a.currentTime
        await a.switchQuality(stripStart(s.manifestUrl))
        schedule(s.expiresAt)
      } catch (e) {
        if (!cancelled) setFailure({ videoId, message: errMsg(e) })
      }
    }

    ;(async () => {
      try {
        const s = await getVideoStream(videoId)
        if (cancelled) return
        start.current = s.resumeAt
        const url = stripStart(s.manifestUrl)
        const aspect = readAspect(videoId)
        nativeAspect.current = s.nativeAspect
        // Native shape: drawn as recorded, no setting. Stretched (older) videos: the saved or default shape.
        const shape = (a: Artplayer) => {
          if (s.nativeAspect) {
            removeAspectSetting(a)
            applyNativeAspect(a)
          } else {
            a.setting.update(aspectSetting(aspect))
            applyAspect(a, aspect)
          }
        }
        if (art.current) {
          shape(art.current)
          await art.current.switchUrl(url)
          art.current.play().catch(() => {})
        } else {
          const a = await create(url, s.nativeAspect ? null : aspectSetting(aspect))
          if (cancelled) return a.destroy(false)
          shape(a)
          art.current = a
          setLayer(a.layers.overlay ?? null)
        }
        if (cancelled) return
        schedule(s.expiresAt)

        // Our listeners are per video; ArtPlayer's own must stay, so remove only these.
        const a = art.current!
        for (const [name, fn] of Object.entries(handlers)) a.on(name, fn)
        if (s.nativeAspect) applyNativeAspect(a) // its metadata may have loaded before the handlers were on
        detach = () => {
          for (const [name, fn] of Object.entries(handlers)) a.off(name, fn)
        }
      } catch (e) {
        if (!cancelled) setFailure({ videoId, message: errMsg(e) })
      }
    })()

    const onHide = () => save(true)
    window.addEventListener("pagehide", onHide)
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener("pagehide", onHide)
      save(true) // leaving this video: remember where we were
      detach()
    }

    async function create(url: string, aspect: ReturnType<typeof aspectSetting> | null) {
      const [{ default: ArtplayerCtor }, { default: HlsCtor }, { default: hlsControl }] = await Promise.all([
        import("artplayer"),
        import("hls.js"),
        import("artplayer-plugin-hls-control"),
      ])
      // Phones: the control bar has no room for picture-in-picture or the quality button (quality stays in
      // settings), and without them fullscreen no longer falls off the right edge.
      const narrow = window.matchMedia("(max-width: 640px)").matches
      // Phones: a double-tap skips instead of toggling play (handled below); desktop keeps double-click fullscreen.
      ArtplayerCtor.MOBILE_DBCLICK_PLAY = false
      const a = new ArtplayerCtor({
        container: container.current!,
        url,
        type: "m3u8",
        autoplay: true,
        theme: "#b8dd73", // --secondary (brand lime): reads on the black stage
        volume: 0.8,
        setting: true,
        playbackRate: true,
        aspectRatio: false,
        hotkey: true,
        pip: !narrow,
        fullscreen: true,
        fullscreenWeb: false,
        miniProgressBar: true,
        mutex: true,
        playsInline: true,
        autoOrientation: true,
        fastForward: true,
        lock: false,
        moreVideoAttr: { preload: "auto" },
        settings: aspect ? [aspect] : [],
        plugins: [
          hlsControl({
            quality: {
              control: !narrow,
              setting: true,
              // By the ladder rung, so a 4:3 or ultra-wide recording still reads 1080p / 720p / 480p.
              getName: (l) => qualityLabel((l as { width: number }).width, (l as { height: number }).height),
              title: "Quality",
              auto: "Auto",
            },
          }),
        ],
        controls: [
          { name: "prev", position: "left", index: 5, html: PREV_ICON, tooltip: "Previous lecture", click: () => cb.current.onPrev?.() },
          { name: "next", position: "left", index: 15, html: NEXT_ICON, tooltip: "Next lecture", click: () => cb.current.onNext?.() },
        ],
        layers: [{ name: "overlay", html: "", style: { position: "absolute", inset: "0", pointerEvents: "none" } }],
        customType: {
          m3u8(video: HTMLVideoElement, src: string, a: Artplayer) {
            const old = a.hls as Hls | undefined
            old?.destroy()
            if (HlsCtor.isSupported()) {
              const hls = new HlsCtor({ startPosition: start.current || -1 })
              hls.on(HlsCtor.Events.ERROR, (_, data) => {
                if (!data.fatal) return
                // A 403 here almost always means the signed URLs expired: re-sign and carry on.
                if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) refresh.current?.()
                else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
                else a.notice.show = "Playback error. Try reloading the page."
              })
              hls.loadSource(src)
              hls.attachMedia(video)
              a.hls = hls
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
              video.src = src // Safari plays HLS natively
              const at = start.current
              if (at > 0) video.addEventListener("loadedmetadata", () => (video.currentTime = at), { once: true })
            } else {
              a.notice.show = "This browser cannot play HLS video."
            }
          },
        },
      })
      // YouTube-style double-tap: the left third skips back, the right third skips forward, the middle plays/pauses.
      a.on("dblclick", (e) => {
        if (!ArtplayerCtor.utils.isMobile) return
        const box = a.template.$player.getBoundingClientRect()
        const x = ((e as MouseEvent).clientX - box.left) / box.width
        if (x > 1 / 3 && x < 2 / 3) return void a.toggle()
        const side = x <= 1 / 3 ? "back" : "fwd"
        if (side === "back") a.backward = SKIP_SEC
        else a.forward = SKIP_SEC
        setSkip((cur) => ({ side, n: (cur?.n ?? 0) + 1 }))
        clearTimeout(skipTimer.current)
        skipTimer.current = setTimeout(() => setSkip(null), 650)
      })
      return a
    }
  }, [videoId])

  // Destroy once, on unmount (declared after the effect above so its final save runs first).
  useEffect(
    () => () => {
      clearTimeout(skipTimer.current)
      ;(art.current?.hls as Hls | undefined)?.destroy()
      art.current?.destroy(false)
      art.current = null
    },
    []
  )

  return (
    // isolate: Artplayer stacks its controls with z-indexes up to 9999. Without its own stacking context
    // they compete with page overlays (the notes viewer, dialogs) and paint on top of them.
    // Native fullscreen uses the browser's top layer, so it is unaffected.
    <div className="relative isolate size-full bg-black" aria-label={`Video player: ${title}`} role="region">
      <div ref={container} className="size-full" />
      {layer && overlay && createPortal(<div className="pointer-events-auto absolute inset-0">{overlay}</div>, layer)}
      {layer &&
        skip &&
        createPortal(
          <div
            key={skip.n}
            aria-hidden
            className={
              "pop pointer-events-none absolute inset-y-0 flex w-2/5 items-center justify-center bg-white/15 text-sm font-semibold text-white " +
              (skip.side === "back" ? "left-0 rounded-r-[50%]" : "right-0 rounded-l-[50%]")
            }
          >
            {skip.side === "back" ? `« ${SKIP_SEC} seconds` : `${SKIP_SEC} seconds »`}
          </div>,
          layer
        )}
      {error && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-6 text-center text-white">
          <p className="text-base font-semibold">This video can&apos;t be played right now.</p>
          <p className="max-w-md text-sm text-white/70">{error}</p>
        </div>
      )}
    </div>
  )
}
