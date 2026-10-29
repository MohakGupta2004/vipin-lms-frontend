import type { Rendition } from "./ladder"

/**
 * A signed upload form from the API (POST /lessons/{id}/videos or /videos/{id}/upload). Each file is POSTed to
 * `url` as multipart/form-data: the fields for its extension, then `key` (keyPrefix + its path), then `file`.
 */
export type UploadForm = {
  url: string
  keyPrefix: string
  /** Per extension: ".m3u8", ".mp4" (init segments), ".m4s". */
  fields: Record<string, Record<string, string>>
  maxFileBytes: number
  expiresAt: string
}

export type ProbeResult = {
  duration: number
  width: number
  height: number
  renditions: Rendition[]
  estimatedBytes: number
  /** Why this file can't be converted here; empty when it can. */
  problems: string[]
}

export type TranscodeProgress = {
  /** 0 to 1. */
  progress: number
  uploadedBytes: number
}

export type ToWorker =
  | { type: "probe"; file: File }
  | { type: "start"; file: File; form: UploadForm }
  /** Reply to "need-form". */
  | { type: "form"; form: UploadForm }
  | { type: "form-error"; message: string }

export type FromWorker =
  | { type: "probed"; result: ProbeResult }
  | ({ type: "progress" } & TranscodeProgress)
  /** Uploads are failing and being retried; encoding is paused by backpressure meanwhile. */
  | { type: "network"; waiting: boolean }
  /** The upload form is about to expire or was refused: the page should fetch a fresh one. */
  | { type: "need-form" }
  | { type: "done" }
  | { type: "error"; message: string }
