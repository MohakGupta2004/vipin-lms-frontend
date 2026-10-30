// Converting and uploading run together (a slow network pauses the encoders), so the speed of the job's overall
// progress already covers both. Only recent progress counts: speed changes over a long job.
const WINDOW_MS = 90_000
// Short enough that a video of a minute or two still gets a measured time.
const MIN_SPAN_MS = 3_000
// A silence this long means the computer slept; what came before says nothing about the speed now.
const MAX_GAP_MS = 2 * 60_000
// The shown time changes this often at most, so it doesn't flicker between two rounded values.
const UPDATE_MS = 5_000

type Sample = { at: number; progress: number }

/**
 * Estimates the seconds left in a job from its progress (0 to 1). There is always an answer: until the speed can
 * be measured it assumes the video takes as long to process as it does to watch.
 */
export function timeLeftEstimator(durationSec: number) {
  let samples: Sample[] = []
  let secondsLeft: number | undefined
  let updatedAt = 0

  const reset = () => {
    samples = []
    secondsLeft = undefined
    updatedAt = 0
  }

  const update = (progress: number, at = Date.now()) => {
    const last = samples[samples.length - 1]
    if (last && at - last.at > MAX_GAP_MS) reset()
    samples.push({ at, progress })
    // One sample stays just outside the window, so a slow job always has a full window's span to measure.
    while (samples.length > 2 && at - samples[1].at > WINDOW_MS) samples.shift()

    const first = samples[0]
    const span = at - first.at
    if (at - updatedAt >= UPDATE_MS && span >= MIN_SPAN_MS) {
      const perMs = (progress - first.progress) / span
      updatedAt = at
      secondsLeft = perMs > 0 ? (1 - progress) / perMs / 1000 : undefined
    }
    return secondsLeft ?? durationSec * (1 - progress)
  }

  return { update, reset }
}

/** A rough, plain-words time: the longer the wait, the less exact it pretends to be. */
export function fmtTimeLeft(seconds: number) {
  if (seconds < 60) return "Less than a minute left"
  const exact = seconds / 60
  const step = exact < 10 ? 1 : exact < 60 ? 5 : 10
  const minutes = Math.round(exact / step) * step
  if (minutes < 60) return `About ${minutes} min left`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `About ${hours} ${hours === 1 ? "hour" : "hours"}${rest ? ` ${rest} min` : ""} left`
}
