/** One video rendition of the HLS ladder. `label` is also its playlist name and folder ("720p.m3u8", "720p/"). */
export type Rendition = {
  label: string
  width: number
  height: number
  videoBitrate: number
}

// Each rung is a 16:9 box (9:16 for portrait). The recording is scaled to fit inside it, keeping its own
// shape, so a 4:3 screen recording becomes 1440×1080 / 960×720 / 640×480 and a 1920×800 one is still "1080p".
export const LADDER = [
  { label: "1080p", long: 1920, short: 1080, videoBitrate: 5_000_000 },
  { label: "720p", long: 1280, short: 720, videoBitrate: 2_800_000 },
  { label: "480p", long: 854, short: 480, videoBitrate: 1_400_000 },
] as const

// Apple's HLS authoring spec recommends 6 s segments; a keyframe every 2 s on every rendition keeps the
// segment boundaries aligned, so the player can switch quality without a hiccup.
export const SEGMENT_DURATION = 6
export const KEYFRAME_INTERVAL = 2
export const AUDIO_BITRATE_ESTIMATE = 128_000

// Matches the server: one video's HLS files may be at most 25 GB.
export const MAX_OUTPUT_BYTES = 25 * 1024 ** 3
// Long enough for any lecture; the server caps files per video, which also bounds this.
export const MAX_DURATION_SEC = 5 * 60 * 60

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

export function planRenditions(srcWidth: number, srcHeight: number): Rendition[] {
  const portrait = srcHeight > srcWidth
  const boxes = LADDER.map((r) => ({
    label: r.label as string,
    videoBitrate: r.videoBitrate,
    boxWidth: portrait ? r.short : r.long,
    boxHeight: portrait ? r.long : r.short,
  }))

  // A rung applies once the source reaches its box in either dimension (5% slack for sizes like
  // 1920×1072). Never upscale: a source smaller than 480p gets one rung at its own size.
  let rungs = boxes.filter((b) => srcWidth >= b.boxWidth * 0.95 || srcHeight >= b.boxHeight * 0.95)
  if (rungs.length === 0) {
    const lowest = boxes[boxes.length - 1]
    rungs = [{ ...lowest, label: `${even(Math.min(srcWidth, srcHeight))}p` }]
  }

  return rungs.map((b) => {
    const scale = Math.min(1, b.boxWidth / srcWidth, b.boxHeight / srcHeight)
    const width = even(srcWidth * scale)
    const height = even(srcHeight * scale)
    // Same bits per pixel on every shape: a 1920×800 picture needs ~26% fewer bits than 1920×1080.
    const pixelRatio = Math.min(1, (width * height) / (b.boxWidth * b.boxHeight))
    return { label: b.label, width, height, videoBitrate: Math.round(b.videoBitrate * pixelRatio) }
  })
}

export function estimateOutputBytes(renditions: Rendition[], duration: number, hasAudio: boolean) {
  const videoBits = renditions.reduce((sum, r) => sum + r.videoBitrate, 0)
  const audioBits = hasAudio ? AUDIO_BITRATE_ESTIMATE : 0
  // ~3% container overhead for the fMP4 boxes.
  return ((videoBits + audioBits) * duration * 1.03) / 8
}

/**
 * The quality name for a rendition the player found in a playlist: the ladder rung whose box it touches,
 * so a 1920×800 or 1440×1080 picture reads "1080p" (not "800p"). Anything else, such as the 640×360 of
 * older videos, is named by its short side.
 */
export function qualityLabel(width: number, height: number) {
  const long = Math.max(width, height)
  const short = Math.min(width, height)
  const rung = LADDER.find(
    (r) => long <= r.long * 1.05 && short <= r.short * 1.05 && (long >= r.long * 0.95 || short >= r.short * 0.95)
  )
  return rung ? rung.label : `${short}p`
}
