import { sampleToGrid } from "./raster"

export type FrameRange = { start: number; end: number }

export const clampToVideo = (video: HTMLVideoElement, time: number) =>
  Math.max(0, Math.min(time, Math.max(0, video.duration - 0.001)))

export const exportFrameTotal = (duration: number, fps: number) => {
  if (!Number.isFinite(duration) || duration <= 0) return 1
  return Math.max(1, Math.ceil(duration * fps))
}

export const seekVideo = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const target = clampToVideo(video, time)
    if (Math.abs(video.currentTime - target) < 0.0005) {
      resolve()
      return
    }
    video.addEventListener("seeked", () => resolve(), { once: true })
    video.addEventListener("error", () => reject(new Error("Video seek failed")), { once: true })
    video.currentTime = target
  })

export const loadVideo = async (url: string) => {
  const video = document.createElement("video")
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  await new Promise((resolve, reject) => {
    video.addEventListener("loadedmetadata", resolve, { once: true })
    video.addEventListener("error", reject, { once: true })
  })
  return video
}

export const sampleVideoGrids = async (
  video: HTMLVideoElement,
  threshold: number,
  invert: boolean,
  fps: number,
  range: FrameRange,
  onProgress?: (done: number, total: number) => void,
) => {
  const duration = video.duration
  if (!Number.isFinite(duration) || duration <= 0) return []

  const total = exportFrameTotal(duration, fps)
  const start = Math.max(0, Math.min(range.start, total - 1))
  const end = Math.max(start, Math.min(range.end, total - 1))
  const frameCount = end - start + 1

  const savedTime = video.currentTime
  const grids: Uint8Array[] = []

  for (let i = 0; i < frameCount; i += 1) {
    const frameIndex = start + i
    const t = Math.min(frameIndex / fps, duration - 0.001)
    await seekVideo(video, t)
    grids.push(sampleToGrid(video, threshold, invert))
    onProgress?.(i + 1, frameCount)
  }

  await seekVideo(video, savedTime)
  return grids
}
