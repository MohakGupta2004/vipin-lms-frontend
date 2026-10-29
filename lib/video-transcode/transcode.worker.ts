// Runs in a dedicated worker, one per job: the page terminates it when the job ends in any way, which is the
// only hard guarantee that every decoder, encoder, video frame and buffer it held is released.
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CmafOutputFormat,
  Conversion,
  HlsOutputFormat,
  Input,
  Output,
  OutputTrackGroup,
  PathedTarget,
  Quality,
  canEncodeAudio,
  canEncodeVideo,
  type OutputTrack,
} from "mediabunny"

import {
  KEYFRAME_INTERVAL,
  MAX_DURATION_SEC,
  MAX_OUTPUT_BYTES,
  SEGMENT_DURATION,
  estimateOutputBytes,
  planRenditions,
} from "./ladder"
import type { FromWorker, ProbeResult, ToWorker, UploadForm } from "./protocol"

const MANIFEST = "manifest.m3u8"
// Every file this worker writes: a playlist at the top, or an init/media segment one folder down.
const OUTPUT_PATH = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)?\.(m3u8|mp4|m4s)$/

const post = (msg: FromWorker) => self.postMessage(msg)

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data
  switch (msg.type) {
    case "probe":
      run(async () => post({ type: "probed", result: await probe(msg.file) }))
      break
    case "start":
      run(() => transcode(msg.file, msg.form))
      break
    case "form":
      formRequest?.resolve(msg.form)
      break
    case "form-error":
      formRequest?.reject(new Error(msg.message))
      break
  }
}

function run(job: () => Promise<void>) {
  job().catch((err) => post({ type: "error", message: errorText(err) }))
}

function errorText(err: unknown) {
  if (err instanceof Error && err.message) return err.message
  return typeof err === "string" && err ? err : "Converting the video failed."
}

const openInput = (file: File) => new Input({ source: new BlobSource(file), formats: ALL_FORMATS })

// ── probe ───────────────────────────────────────────────────────────────────

async function probe(file: File): Promise<ProbeResult> {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
    return unreadable("This browser can't convert video. Use the latest Chrome, Edge or Safari.")
  }
  const input = openInput(file)
  try {
    return await probeInput(input)
  } catch (err) {
    console.error(err)
    return unreadable("This file can't be read. It may be damaged, or in a format this browser doesn't support.")
  } finally {
    input.dispose()
  }
}

const unreadable = (problem: string): ProbeResult => ({
  duration: 0,
  width: 0,
  height: 0,
  renditions: [],
  estimatedBytes: 0,
  problems: [problem],
})

async function probeInput(input: Input): Promise<ProbeResult> {
  const video = await input.getPrimaryVideoTrack()
  if (!video) return unreadable("This file has no video in it.")
  const audio = await input.getPrimaryAudioTrack()
  const [duration, width, height] = await Promise.all([
    input.computeDuration(),
    video.getDisplayWidth(),
    video.getDisplayHeight(),
  ])
  const renditions = planRenditions(width, height)
  const estimatedBytes = estimateOutputBytes(renditions, duration, !!audio)
  const problems: string[] = []

  if (!(duration > 0) || !(width > 0) || !(height > 0)) {
    problems.push("This video's length or size can't be read.")
  } else if (duration > MAX_DURATION_SEC) {
    problems.push(`The video must be at most ${MAX_DURATION_SEC / 3600} hours long.`)
  } else if (estimatedBytes > MAX_OUTPUT_BYTES) {
    problems.push("This video is too long to upload at these qualities.")
  }
  if (!(await video.canDecode())) {
    const codec = await video.getCodecParameterString().catch(() => null)
    problems.push(
      `This browser can't read this video's format${codec ? ` (${codec})` : ""}. Try Chrome, Edge or Safari, or export it as MP4 (H.264).`
    )
  }
  const top = renditions[0]
  const quality = top && new Quality({ bitrate: top.videoBitrate })
  if (top && !(await canEncodeVideo("avc", { width: top.width, height: top.height, quality }))) {
    problems.push("This browser can't encode H.264 video. Use the latest Chrome, Edge or Safari.")
  }
  // Students on iPhones need AAC: AAC is copied as is, anything else must be re-encoded to AAC.
  if (audio && audio.codec !== "aac") {
    if (!(await audio.canDecode())) problems.push("This browser can't read the sound in this file.")
    else if (!(await canEncodeAudio("aac"))) problems.push("This browser can't encode AAC audio. Use Chrome, Edge or Safari on a Mac or PC.")
  }
  return { duration, width, height, renditions, estimatedBytes, problems }
}

// ── upload form ─────────────────────────────────────────────────────────────

// Forms last an hour. Renew a few minutes early, measured from when this worker got the form so a wrong
// computer clock can't make it renew constantly; a form refused anyway (403) is renewed at once.
const RENEW_EARLY_MS = 5 * 60_000
const MIN_FORM_LIFE_MS = 60_000
const MAX_FORM_LIFE_MS = 55 * 60_000

let form: UploadForm | null = null
let renewAt = 0
let formRequest: { promise: Promise<UploadForm>; resolve: (f: UploadForm) => void; reject: (e: Error) => void } | null =
  null

function setForm(f: UploadForm) {
  form = f
  const life = Date.parse(f.expiresAt) - Date.now() - RENEW_EARLY_MS
  renewAt = Date.now() + Math.min(MAX_FORM_LIFE_MS, Math.max(MIN_FORM_LIFE_MS, Number.isFinite(life) ? life : 0))
}

/** Asks the page for a fresh form. Concurrent callers share one request. */
function renewForm(): Promise<UploadForm> {
  if (!formRequest) {
    let resolve!: (f: UploadForm) => void
    let reject!: (e: Error) => void
    const promise = new Promise<UploadForm>((res, rej) => {
      resolve = res
      reject = rej
    })
    formRequest = {
      promise,
      resolve: (f) => {
        formRequest = null
        setForm(f)
        resolve(f)
      },
      reject: (e) => {
        formRequest = null
        reject(e)
      },
    }
    post({ type: "need-form" })
  }
  return formRequest.promise
}

const currentForm = () => (form && Date.now() < renewAt ? Promise.resolve(form) : renewForm())

// ── uploads ─────────────────────────────────────────────────────────────────

// Jobs can run for an hour or more, so Wi-Fi drops are expected. Time spent offline is free; only failures
// while the browser believes it is online count, and 20 of those with backoff capped at 30 s is about 10
// minutes of a broken network or storage before the job gives up.
const MAX_ONLINE_FAILURES = 20
const MAX_BACKOFF_MS = 30_000

let failingUploads = 0
function setFailing(delta: 1 | -1) {
  const wasWaiting = failingUploads > 0
  failingUploads += delta
  if (wasWaiting !== failingUploads > 0) post({ type: "network", waiting: failingUploads > 0 })
}

/** Resolves after `ms`, or as soon as the connection is back, whichever is first. Rejects on abort. */
function waitToRetry(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      self.removeEventListener("online", onOnline)
      signal.removeEventListener("abort", onAbort)
    }
    const onOnline = () => {
      cleanup()
      resolve()
    }
    const onAbort = () => {
      cleanup()
      reject(signal.reason)
    }
    const timer = setTimeout(onOnline, ms)
    self.addEventListener("online", onOnline)
    signal.addEventListener("abort", onAbort)
  })
}

/** The readable part of a Cloud Storage XML error. */
function storageMessage(body: string) {
  return /<Message>([^<]{1,300})<\/Message>/.exec(body)?.[1] ?? ""
}

/** Uploads one file with the signed form. Network errors, 5xx and 429 are retried; offline waits indefinitely. */
async function upload(path: string, data: ArrayBuffer, signal: AbortSignal) {
  if (!OUTPUT_PATH.test(path)) throw new Error(`Unexpected output file ${path}.`)
  const ext = path.slice(path.lastIndexOf("."))
  let onlineFailures = 0
  let renewedAfterRefusal = false
  let failing = false
  try {
    for (let attempt = 0; ; attempt++) {
      const f = await currentForm()
      const fields = f.fields[ext]
      if (!fields) throw new Error(`The upload form has no entry for ${ext} files.`)
      if (data.byteLength > f.maxFileBytes) throw new Error(`${path} is larger than storage accepts.`)

      // "file" must be the last field.
      const body = new FormData()
      for (const [k, v] of Object.entries(fields)) body.append(k, v)
      body.append("key", f.keyPrefix + path)
      body.append("file", new Blob([data], { type: fields["content-type"] }))

      let res: Response | null = null
      let error: unknown
      try {
        res = await fetch(f.url, { method: "POST", body, signal })
      } catch (err) {
        if (signal.aborted) throw err
        error = err
      }
      if (res?.ok) return

      let retryable = true
      if (res) {
        const message = storageMessage(await res.text().catch(() => ""))
        error = new Error(`Storage refused ${path} (HTTP ${res.status}${message ? `: ${message}` : ""}).`)
        // A refused form is almost always an expired one (laptop asleep, clock drift). Cloud Storage answers
        // policy failures with 400 InvalidPolicyDocument or 403, so renew once and retry at once; a real
        // violation is refused again with the fresh form and then fails the job.
        if ((res.status === 400 || res.status === 403) && !renewedAfterRefusal) {
          renewedAfterRefusal = true
          await renewForm()
          continue
        }
        retryable = res.status >= 500 || res.status === 429 || res.status === 408
      }
      if (!retryable) throw error
      if (navigator.onLine && ++onlineFailures >= MAX_ONLINE_FAILURES) throw error
      if (!failing) {
        failing = true
        setFailing(1)
      }
      await waitToRetry(navigator.onLine ? Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) : MAX_BACKOFF_MS, signal)
    }
  } finally {
    if (failing) setFailing(-1)
  }
}

// ── transcode ───────────────────────────────────────────────────────────────

async function transcode(file: File, initialForm: UploadForm) {
  setForm(initialForm)
  const input = openInput(file)
  try {
    await transcodeInput(input)
  } finally {
    input.dispose()
  }
  post({ type: "done" })
}

async function transcodeInput(input: Input) {
  const video = await input.getPrimaryVideoTrack()
  if (!video) throw new Error("This file has no video in it.")
  // Display size includes rotation and pixel aspect ratio.
  const renditions = planRenditions(await video.getDisplayWidth(), await video.getDisplayHeight())

  // One group per video rendition; the audio track joins all of them, which makes one shared audio playlist
  // that every rendition refers to, so the sound is encoded and uploaded once instead of three times.
  const groups = renditions.map(() => new OutputTrackGroup())
  const playlistName = (track: OutputTrack) => {
    if (track.type === "audio") return "audio"
    const i = groups.indexOf(track.metadata.group as OutputTrackGroup)
    if (i === -1) throw new Error("Internal error: a video track has no rendition.")
    return renditions[i].label
  }

  const abort = new AbortController()
  let uploadedBytes = 0
  let progress = 0
  let lastPost = 0
  // Throttled; also sent after every finished upload, so a slow connection still shows (and proves) life.
  const report = () => {
    const now = performance.now()
    if (now - lastPost < 250) return
    lastPost = now
    post({ type: "progress", progress, uploadedBytes })
  }

  // Flat layout, which the API's playlist route and the CDN signature both rely on:
  //   manifest.m3u8, 720p.m3u8, 720p/init.mp4, 720p/seg-00001.m4s, …, audio.m3u8, audio/…
  const output = new Output({
    format: new HlsOutputFormat({
      segmentFormat: new CmafOutputFormat(),
      targetDuration: SEGMENT_DURATION,
      getPlaylistPath: ({ tracks }) => `${playlistName(tracks[0])}.m3u8`,
      getInitPath: ({ tracks }) => `${playlistName(tracks[0])}/init.mp4`,
      getSegmentPath: ({ n, format, playlist }) =>
        `${playlistName(playlist.tracks[0])}/seg-${String(n).padStart(5, "0")}${format.fileExtension}`,
    }),
    // Each file is built in memory and uploaded the moment it is complete, then dropped; nothing is written
    // to browser storage. Mediabunny awaits onFinalize, so a slow network pauses the encoders instead of
    // letting finished segments pile up in memory.
    target: new PathedTarget(
      MANIFEST,
      ({ path }) =>
        new BufferTarget({
          onFinalize: async (data) => {
            await upload(path, data, abort.signal)
            uploadedBytes += data.byteLength
            report()
          },
        })
    ),
  })

  const conversion = await Conversion.init({
    input,
    output,
    tracks: "primary",
    video: renditions.map((r, i) => ({
      width: r.width,
      height: r.height,
      fit: "fill" as const,
      codec: "avc" as const,
      quality: new Quality({ bitrate: r.videoBitrate }),
      keyFrameInterval: KEYFRAME_INTERVAL,
      // Even an H.264 source of the right size is re-encoded: aligned keyframes are what make segments switchable.
      forceTranscode: true,
      // HLS players ignore rotation metadata, so bake the rotation into the pixels.
      allowTransformationMetadata: false,
      group: groups[i],
    })),
    // AAC is copied untouched; anything else is re-encoded to AAC. No bitrate here: it would force a re-encode.
    audio: { codec: "aac", group: groups },
    showWarnings: false,
  })

  const dropped = conversion.discardedTracks.filter((d) => d.reason !== "discarded_by_user")
  if (!conversion.isValid || dropped.length > 0) {
    await output.cancel().catch(() => {})
    const why = dropped.map((d) => `${d.track.isVideoTrack() ? "video" : "sound"}: ${d.reason.replaceAll("_", " ")}`)
    throw new Error(`This file can't be converted here (${why.join("; ") || "unsupported"}).`)
  }

  conversion.onProgress = (p) => {
    progress = p
    report()
  }

  try {
    await conversion.execute()
  } catch (err) {
    abort.abort() // stop sibling uploads still in flight
    throw err
  }
  post({ type: "progress", progress: 1, uploadedBytes })
}
