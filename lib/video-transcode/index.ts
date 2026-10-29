import type { FromWorker, ProbeResult, ToWorker, TranscodeProgress, UploadForm } from "./protocol"

export type { ProbeResult, TranscodeProgress, UploadForm }

/**
 * Browser-side video conversion: the instructor's computer turns a recording into a 1080p/720p/480p HLS ladder
 * and uploads it straight to storage, so no server-side transcoding is paid for.
 *
 * Every job runs in its own worker that is terminated when the job ends, whether it finished, failed or was
 * cancelled, so nothing it used (decoders, encoders, frames, upload buffers) outlives it.
 */

/** Whether this browser can convert video at all: WebCodecs needs Chrome, Edge or Safari, over https or localhost. */
export function canConvertVideo() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof Worker !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof VideoDecoder !== "undefined"
  )
}

const abortError = () => new DOMException("Cancelled", "AbortError")

// One conversion at a time on the page: each already runs a decoder and encoder per rendition on the GPU's
// media engine, so a second would only slow both down and double the memory in use.
let slotTaken = false
const waiting: Array<() => void> = []

/**
 * Waits for the page's conversion slot and resolves to its release function (safe to call more than once).
 * Rejects with an AbortError if `signal` aborts while waiting, leaving the queue as it was.
 */
export function acquireConversionSlot(signal: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    let released = false
    const release = () => {
      if (released) return
      released = true
      const next = waiting.shift()
      if (next) next()
      else slotTaken = false
    }
    const grant = () => {
      signal.removeEventListener("abort", onAbort)
      resolve(release)
    }
    const onAbort = () => {
      const i = waiting.indexOf(grant)
      if (i !== -1) waiting.splice(i, 1)
      reject(abortError())
    }
    if (!slotTaken) {
      slotTaken = true
      return grant()
    }
    waiting.push(grant)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

type Handler<T> = (msg: FromWorker, ctl: { worker: Worker; done: (v: T) => void; fail: (e: Error) => void }) => void

/**
 * Starts a fresh worker, feeds its messages to `handle` until it calls done or fail, then terminates it.
 * Aborting `signal` terminates it at once. With `stallMs`, a worker that has gone quiet for that long (and
 * isn't `idle()`, e.g. waiting for the network) is treated as hung.
 */
function runWorker<T>(
  signal: AbortSignal,
  first: ToWorker,
  handle: Handler<T>,
  watchdog?: { stallMs: number; idle: () => boolean }
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    const worker = new Worker(new URL("./transcode.worker.ts", import.meta.url), { type: "module" })
    let settled = false
    let lastHeard = Date.now()
    const timer = watchdog
      ? setInterval(() => {
          if (watchdog.idle()) lastHeard = Date.now()
          else if (Date.now() - lastHeard > watchdog.stallMs) fail(new Error("The video converter stopped responding. Try again."))
        }, 15_000)
      : undefined
    const finish = () => {
      settled = true
      clearInterval(timer)
      signal.removeEventListener("abort", onAbort)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
    }
    const done = (v: T) => {
      if (settled) return
      finish()
      resolve(v)
    }
    const fail = (e: Error) => {
      if (settled) return
      finish()
      reject(e)
    }
    const onAbort = () => fail(abortError())
    signal.addEventListener("abort", onAbort, { once: true })
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      if (settled) return
      lastHeard = Date.now()
      handle(e.data, { worker, done, fail })
    }
    worker.onerror = (e) => {
      e.preventDefault()
      fail(new Error(e.message || "The video converter crashed. Try again."))
    }
    worker.onmessageerror = () => fail(new Error("The video converter failed. Try again."))
    worker.postMessage(first)
  })
}

/** Reads a file's video details and whether this browser can convert it. Uploads nothing. */
export function probeVideo(file: File, signal: AbortSignal) {
  return runWorker<ProbeResult>(signal, { type: "probe", file }, (msg, { done, fail }) => {
    if (msg.type === "probed") done(msg.result)
    else if (msg.type === "error") fail(new Error(msg.message))
  })
}

// A job with no progress, no finished upload and no network trouble for this long is hung (a stuck encoder).
const STALL_MS = 10 * 60_000
// Same patience as the worker's uploads: offline time is free, ~20 failures while online give up.
const MAX_ONLINE_FAILURES = 20
const MAX_BACKOFF_MS = 30_000

/** Resolves after `ms` or once the connection is back; rejects on abort. */
function waitToRetry(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      window.removeEventListener("online", onOnline)
      signal.removeEventListener("abort", onAbort)
    }
    const onOnline = () => {
      cleanup()
      resolve()
    }
    const onAbort = () => {
      cleanup()
      reject(abortError())
    }
    const timer = setTimeout(onOnline, ms)
    window.addEventListener("online", onOnline)
    signal.addEventListener("abort", onAbort)
  })
}

/**
 * Renews the upload form, retrying while the network or the API is down (a laptop waking up offline needs a
 * fresh form before it can upload anything). Refusals such as a deleted video (4xx) fail at once.
 */
async function renewWithRetry(renew: () => Promise<UploadForm>, signal: AbortSignal, onNetwork: (waiting: boolean) => void) {
  let onlineFailures = 0
  let waiting = false
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await renew()
      } catch (e) {
        const status = (e as { status?: unknown }).status
        const transient = status === 0 || status === 429 || (typeof status === "number" && status >= 500)
        if (!transient || signal.aborted) throw e
        if (navigator.onLine && ++onlineFailures >= MAX_ONLINE_FAILURES) throw e
        if (!waiting) onNetwork((waiting = true))
        await waitToRetry(navigator.onLine ? Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) : MAX_BACKOFF_MS, signal)
      }
    }
  } finally {
    if (waiting) onNetwork(false)
  }
}

/**
 * Converts `file` to HLS and uploads every file with `form`. Resolves once all files are in storage.
 * `renewForm` is called when the form is about to expire (long jobs) or storage refuses it.
 */
export function transcodeAndUpload(
  file: File,
  opts: {
    form: UploadForm
    renewForm: () => Promise<UploadForm>
    onProgress: (p: TranscodeProgress) => void
    onNetwork: (waiting: boolean) => void
    signal: AbortSignal
  }
) {
  let networkWaiting = false
  let renewing = false
  return runWorker<void>(
    opts.signal,
    { type: "start", file, form: opts.form },
    (msg, { worker, done, fail }) => {
      switch (msg.type) {
        case "progress":
          opts.onProgress({ progress: msg.progress, uploadedBytes: msg.uploadedBytes })
          break
        case "network":
          networkWaiting = msg.waiting
          opts.onNetwork(msg.waiting)
          break
        case "need-form":
          renewing = true
          renewWithRetry(opts.renewForm, opts.signal, (waiting) => opts.onNetwork(waiting || networkWaiting))
            .then(
              (form) => worker.postMessage({ type: "form", form } satisfies ToWorker),
              (e: unknown) =>
                worker.postMessage({
                  type: "form-error",
                  message: e instanceof Error ? e.message : "Couldn't renew the upload.",
                } satisfies ToWorker)
            )
            .finally(() => (renewing = false))
          break
        case "done":
          done()
          break
        case "error":
          fail(new Error(msg.message))
          break
      }
    },
    { stallMs: STALL_MS, idle: () => networkWaiting || renewing }
  )
}
