import {
  DEFAULT_EXPORT_FPS,
  DEFAULT_TICKS_PER_FRAME,
  GRID_H,
  GRID_W,
  MAX_EXPORT_FPS,
  MIN_EXPORT_FPS,
} from "./constants.js"
import { countNoteEvents, downloadMidi } from "./midi.js"
import { drawGrid } from "./preview.js"
import { lumaToGrid, otsuThreshold, sampleSourceLuma, sampleToGrid } from "./raster.js"

const dropzone = document.getElementById("dropzone")
const fileInput = document.getElementById("file-input")
const fileNameEl = document.getElementById("file-name")
const thresholdInput = document.getElementById("threshold")
const thresholdValue = document.getElementById("threshold-value")
const invertInput = document.getElementById("invert")
const exportStatus = document.getElementById("export-status")
const midiNotesCountEl = document.getElementById("midi-notes-count")
const scaleInput = document.getElementById("scale")
const videoTimeline = document.getElementById("video-timeline")
const exportFpsInput = document.getElementById("export-fps")
const exportFpsValue = document.getElementById("export-fps-value")
const frameInput = document.getElementById("frame")
const frameCurrentValue = document.getElementById("frame-current-value")
const exportFrameStartReadout = document.getElementById("export-frame-start-readout")
const exportFrameEndReadout = document.getElementById("export-frame-end-readout")
const framePlayhead = document.getElementById("frame-playhead")
const exportFrameStart = document.getElementById("export-frame-start")
const exportFrameEnd = document.getElementById("export-frame-end")
const exportRangeFill = document.getElementById("export-range-fill")
const exportRangeRail = document.getElementById("export-range-dual")
const preview = document.getElementById("preview")
const exportVideoMidiBtn = document.getElementById("export-video-midi")
const previewPlaybackBtn = document.getElementById("preview-playback")
const previewResetStartBtn = document.getElementById("preview-reset-start")
const bpmInput = document.getElementById("bpm")

/** @type {{ kind: "image" | "video"; url: string; name: string; video?: HTMLVideoElement; image?: HTMLImageElement } | null} */
let media = null
/** @type {Uint8Array | null} */
let currentGrid = null
/** @type {Uint8Array | null} */
let currentLumas = null
/** @type {number} */
let lastExportFps = DEFAULT_EXPORT_FPS
/** @type {boolean} */
let previewPlaying = false
/** @type {number | null} */
let previewAnimFrame = null
/** @type {number} */
let previewSession = 0
/** @type {number} */
let previewStartPerf = 0
/** @type {number} */
let previewDisplayedFrame = -1
/** @type {boolean} */
let previewSeekInFlight = false
/** @type {number} */
let previewStartFrame = 0
/** @type {{ fps: number; exportRange: { start: number; end: number }; threshold: number; invert: boolean; scale: number } | null} */
let previewParams = null
/** @type {number | null} */
let videoNoteCountCache = null
/** @type {{ threshold: number; invert: boolean; fps: number; start: number; end: number; mediaUrl: string } | null} */
let videoNoteCountParams = null
/** @type {number} */
let videoNoteCountSession = 0
/** @type {ReturnType<typeof setTimeout> | null} */
let videoNoteCountDebounce = null

const previewLockTargets = () => [
  thresholdInput,
  invertInput,
  scaleInput,
  frameInput,
  exportFrameStart,
  exportFrameEnd,
  exportFpsInput,
  bpmInput,
  exportVideoMidiBtn,
  fileInput,
].filter(Boolean)

const setPreviewUiLocked = (locked) => {
  for (const el of previewLockTargets()) el.disabled = locked
  previewPlaybackBtn.classList.toggle("is-playing", locked)
  previewPlaybackBtn.setAttribute("aria-label", locked ? "Stop preview" : "Play preview")
  dropzone.style.pointerEvents = locked ? "none" : ""
  dropzone.style.opacity = locked ? "0.65" : ""
}

const cancelPreviewAnimationFrame = () => {
  if (previewAnimFrame !== null) {
    cancelAnimationFrame(previewAnimFrame)
    previewAnimFrame = null
  }
}

const cancelPreviewAnimation = () => {
  previewSession += 1
  cancelPreviewAnimationFrame()
  previewSeekInFlight = false
  previewParams = null
  previewDisplayedFrame = -1
}

const stopPreviewPlayback = async () => {
  previewPlaying = false
  cancelPreviewAnimation()
  setPreviewUiLocked(false)
  const hasVideo = media?.kind === "video"
  previewPlaybackBtn.disabled = !hasVideo
  previewResetStartBtn.disabled = !hasVideo
}

const finishPreviewPlayback = async () => {
  const range = previewParams?.exportRange
  if (range) {
    exportStatus.textContent = `Preview finished (frames ${range.start}–${range.end}).`
  }
  await stopPreviewPlayback()
  refreshGrid()
  updateExportStatus()
}

const renderPreviewExportFrame = async (frameIndex, session) => {
  const params = previewParams
  const video = media?.video
  if (!previewPlaying || session !== previewSession || !params || !video) return false

  const { fps, exportRange, threshold, invert, scale } = params
  try {
    const t = Math.min(frameIndex / fps, Math.max(0, video.duration - 0.001))
    await seekVideo(video, t)
    if (!previewPlaying || session !== previewSession) return false
    const grid = sampleToGrid(video, threshold, invert)
    currentGrid = grid
    drawGrid(preview, grid, scale)
    exportStatus.textContent = `Previewing export frame ${frameIndex} of ${exportRange.start}–${exportRange.end}…`
    previewDisplayedFrame = frameIndex
    updateTimelineReadouts(t, frameIndex)
    return true
  } catch {
    exportStatus.textContent = "Preview stopped (video seek failed)."
    await stopPreviewPlayback()
    refreshGrid()
    return false
  }
}

const onPreviewAnimationFrame = (timestamp) => {
  if (!previewPlaying) return

  const session = previewSession
  const params = previewParams
  const video = media?.video
  if (!params || !video) {
    void stopPreviewPlayback()
    return
  }

  const { fps, exportRange } = params
  const elapsedSec = (timestamp - previewStartPerf) / 1000
  const frameIndex = previewStartFrame + Math.floor(elapsedSec * fps)

  if (frameIndex > exportRange.end) {
    finishPreviewPlayback()
    return
  }

  if (
    frameIndex !== previewDisplayedFrame &&
    !previewSeekInFlight &&
    frameIndex > previewDisplayedFrame
  ) {
    previewSeekInFlight = true
    const targetFrame = frameIndex
    renderPreviewExportFrame(targetFrame, session).finally(() => {
      previewSeekInFlight = false
    })
  }

  previewAnimFrame = requestAnimationFrame(onPreviewAnimationFrame)
}

const startPreviewAnimation = async () => {
  cancelPreviewAnimationFrame()
  previewSeekInFlight = false
  const session = previewSession
  const params = previewParams
  if (!params) return

  const { fps, exportRange } = params
  const scrubFrame = timeToExportFrameIndex(Number(frameInput.value), fps)
  previewStartFrame = Math.min(
    exportRange.end,
    Math.max(exportRange.start, scrubFrame),
  )
  previewStartPerf = performance.now()
  previewDisplayedFrame = previewStartFrame - 1
  previewSeekInFlight = true
  await renderPreviewExportFrame(previewStartFrame, session)
  previewSeekInFlight = false
  if (!previewPlaying || session !== previewSession) return
  previewAnimFrame = requestAnimationFrame(onPreviewAnimationFrame)
}

const togglePreviewPlayback = async () => {
  const video = media?.video
  if (!video) return

  if (previewPlaying) {
    await stopPreviewPlayback()
    refreshGrid()
    updateExportStatus()
    return
  }

  previewPlaying = true
  setPreviewUiLocked(true)

  previewParams = {
    fps: getExportFps(),
    exportRange: getExportFrameRange(),
    threshold: Number(thresholdInput.value),
    invert: invertInput.checked,
    scale: Number(scaleInput.value),
  }

  await startPreviewAnimation()
}

const resetPreviewToStart = async () => {
  const video = media?.video
  if (!video) return

  if (previewPlaying) {
    await stopPreviewPlayback()
  }

  const { start } = getExportFrameRange()
  const fps = getExportFps()
  const t = Math.min(start / fps, Math.max(0, video.duration - 0.001))
  frameInput.value = String(t)
  updateTimelineReadouts(t, start)
  try {
    await seekVideo(video, t)
    refreshGrid()
    updateExportStatus()
  } catch {
    exportStatus.textContent = "Could not reset preview to start."
  }
}

const revokeMedia = async () => {
  await stopPreviewPlayback()
  if (media?.url) URL.revokeObjectURL(media.url)
  media = null
  currentGrid = null
  currentLumas = null
  invalidateVideoNoteCountCache()
  if (exportVideoMidiBtn) {
    exportVideoMidiBtn.disabled = true
    exportVideoMidiBtn.hidden = true
  }
  previewPlaybackBtn.disabled = true
  previewResetStartBtn.disabled = true
  videoTimeline.hidden = true
  exportStatus.textContent = ""
  updateMidiNotesReadout()
}

const getExportFps = () => {
  const n = Number(exportFpsInput.value)
  if (!Number.isFinite(n)) return DEFAULT_EXPORT_FPS
  return Math.min(MAX_EXPORT_FPS, Math.max(MIN_EXPORT_FPS, Math.round(n)))
}

const exportFrameTotal = (duration, fps = getExportFps()) => {
  if (!Number.isFinite(duration) || duration <= 0) return 1
  return Math.max(1, Math.ceil(duration * fps))
}

const timeToExportFrameIndex = (seconds, fps = getExportFps()) => {
  const max = Number(exportFrameEnd.max)
  const cap = Number.isFinite(max) && max >= 0 ? max : 0
  const t = Math.max(0, Number(seconds) || 0)
  return Math.min(cap, Math.max(0, Math.floor(t * fps)))
}

/** @param {number} clientX */
const timeFromTimelineClientX = (clientX) => {
  const video = media?.video
  const track = exportRangeRail?.querySelector(".video-trimmer-track")
  if (!video || !track || !Number.isFinite(video.duration) || video.duration <= 0) return null
  const { left, width } = track.getBoundingClientRect()
  if (width <= 0) return null
  const ratio = Math.min(1, Math.max(0, (clientX - left) / width))
  return ratio * video.duration
}

/** @param {number} time seconds */
const scrubToTime = async (time) => {
  const video = media?.video
  if (!video || previewPlaying) return
  const t = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.001)))
  frameInput.value = String(t)
  updateTimelineReadouts(t)
  try {
    await seekVideo(video, t)
    refreshGrid()
  } catch {
    exportStatus.textContent = "Could not seek video for this frame."
  }
}

/** @param {number} frameIndex */
const previewAtExportFrame = async (frameIndex) => {
  const video = media?.video
  if (!video || previewPlaying) return
  const fps = getExportFps()
  const t = Math.min(frameIndex / fps, Math.max(0, video.duration - 0.001))
  frameInput.value = String(t)
  updateTimelineReadouts(t, frameIndex)
  try {
    await seekVideo(video, t)
    refreshGrid()
  } catch {
    exportStatus.textContent = "Could not preview this export frame."
  }
}

const updatePlayheadVisual = (seconds = Number(frameInput.value)) => {
  const duration = media?.video?.duration
  if (!framePlayhead || !Number.isFinite(duration) || duration <= 0) {
    framePlayhead?.style.setProperty("--playhead-ratio", "0")
    return
  }
  const ratio = Math.min(1, Math.max(0, Number(seconds) / duration))
  framePlayhead.style.setProperty("--playhead-ratio", String(ratio))
}

/** @param {number} [seconds] @param {number | undefined} [frameOverride] export frame index when known (preview) */
const updateTimelineReadouts = (seconds = Number(frameInput.value), frameOverride) => {
  const fps = getExportFps()
  const currentFrame =
    frameOverride !== undefined ? frameOverride : timeToExportFrameIndex(seconds, fps)
  frameCurrentValue.textContent = String(currentFrame)
  updatePlayheadVisual(seconds)
}

const updateExportRangeVisual = () => {
  const max = Number(exportFrameEnd.max)
  if (!Number.isFinite(max) || max <= 0) {
    exportRangeFill.style.setProperty("--range-start-ratio", "0")
    exportRangeFill.style.setProperty("--range-end-ratio", "0")
    return
  }
  const start = Number(exportFrameStart.value)
  const end = Number(exportFrameEnd.value)
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  exportRangeFill.style.setProperty("--range-start-ratio", String(lo / max))
  exportRangeFill.style.setProperty("--range-end-ratio", String((max - hi) / max))
}

const updateExportRangeLabel = () => {
  const start = Number(exportFrameStart.value)
  const end = Number(exportFrameEnd.value)
  exportFrameStartReadout.textContent = String(Math.min(start, end))
  exportFrameEndReadout.textContent = String(Math.max(start, end))
  updateExportRangeVisual()
  updateTimelineReadouts()
  invalidateVideoNoteCountCache()
  updateMidiNotesReadout()
}

/** @param {HTMLVideoElement} video */
const setExportFrameRangeBounds = (video, fps = getExportFps()) => {
  const max = exportFrameTotal(video.duration, fps) - 1
  exportFrameStart.min = "0"
  exportFrameEnd.min = "0"
  exportFrameStart.max = String(max)
  exportFrameEnd.max = String(max)
  return max
}

/** @param {HTMLVideoElement} video */
const resetExportFrameRange = (video) => {
  const max = setExportFrameRangeBounds(video)
  exportFrameStart.value = "0"
  exportFrameEnd.value = String(max)
  lastExportFps = getExportFps()
  updateExportRangeLabel()
}

/** @param {HTMLVideoElement} video */
const rescaleExportFrameRange = (video, oldFps, newFps) => {
  const { start, end } = getExportFrameRange()
  const timeStart = start / oldFps
  const timeEnd = (end + 1) / oldFps
  const max = setExportFrameRangeBounds(video, newFps)
  const newStart = Math.min(max, Math.max(0, Math.floor(timeStart * newFps)))
  const newEnd = Math.min(max, Math.max(newStart, Math.ceil(timeEnd * newFps) - 1))
  exportFrameStart.value = String(newStart)
  exportFrameEnd.value = String(newEnd)
  updateExportRangeLabel()
}

const getExportFrameRange = () => {
  let start = Number(exportFrameStart.value)
  let end = Number(exportFrameEnd.value)
  if (start > end) {
    const swap = start
    start = end
    end = swap
  }
  return { start, end }
}

const syncExportFrameHandles = (active) => {
  let start = Number(exportFrameStart.value)
  let end = Number(exportFrameEnd.value)
  if (active === "start" && start > end) exportFrameEnd.value = String(start)
  if (active === "end" && end < start) exportFrameStart.value = String(end)
  updateExportRangeLabel()
}

const getBpm = () => {
  const n = Number(bpmInput.value)
  if (!Number.isFinite(n)) return 120
  return Math.min(999, Math.max(1, Math.round(n)))
}

/** @param {{ videoFps?: number }} [timing] */
const midiExportOptions = (timing = {}) => {
  const bpm = getBpm()
  if (timing.videoFps) {
    const ticksPerFrame = Math.max(
      1,
      Math.round((480 * 60) / (bpm * timing.videoFps)),
    )
    return { bpm, ticksPerFrame }
  }
  return { bpm, ticksPerFrame: DEFAULT_TICKS_PER_FRAME }
}

/** @param {HTMLVideoElement} video */
const seekVideo = (video, time) =>
  new Promise((resolve, reject) => {
    const target = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.001)))
    if (Math.abs(video.currentTime - target) < 0.0005) {
      resolve()
      return
    }
    video.addEventListener("seeked", () => resolve(), { once: true })
    video.addEventListener("error", () => reject(new Error("Video seek failed")), {
      once: true,
    })
    video.currentTime = target
  })

/** @param {HTMLVideoElement} video */
const sampleVideoGrids = async (video, threshold, invert, fps, range, onProgress) => {
  const duration = video.duration
  if (!Number.isFinite(duration) || duration <= 0) return []

  const total = exportFrameTotal(duration, fps)
  let { start, end } = range
  start = Math.max(0, Math.min(start, total - 1))
  end = Math.max(start, Math.min(end, total - 1))
  const frameCount = end - start + 1

  const savedTime = video.currentTime
  const grids = []

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

const activeSource = () => {
  if (!media) return null
  if (media.kind === "video" && media.video) return media.video
  if (media.image) return media.image
  return null
}

const videoNoteCountSignature = () => {
  if (!media?.video) return null
  const { start, end } = getExportFrameRange()
  return {
    threshold: Number(thresholdInput.value),
    invert: invertInput.checked,
    fps: getExportFps(),
    start,
    end,
    mediaUrl: media.url,
  }
}

/** @param {{ threshold: number; invert: boolean; fps: number; start: number; end: number; mediaUrl: string } | null} a @param {typeof a} b */
const videoNoteCountSignaturesMatch = (a, b) => {
  if (!a || !b) return false
  return (
    a.threshold === b.threshold &&
    a.invert === b.invert &&
    a.fps === b.fps &&
    a.start === b.start &&
    a.end === b.end &&
    a.mediaUrl === b.mediaUrl
  )
}

const invalidateVideoNoteCountCache = () => {
  videoNoteCountSession += 1
  videoNoteCountCache = null
  videoNoteCountParams = null
  if (videoNoteCountDebounce !== null) {
    clearTimeout(videoNoteCountDebounce)
    videoNoteCountDebounce = null
  }
}

const computeVideoMidiNotesCount = async () => {
  const video = media?.video
  if (!video || previewPlaying || !midiNotesCountEl) return

  const sig = videoNoteCountSignature()
  if (!sig) return

  const session = ++videoNoteCountSession
  midiNotesCountEl.textContent = "…"

  const savedScrubTime = Number(frameInput.value)

  try {
    const frames = await sampleVideoGrids(
      video,
      sig.threshold,
      sig.invert,
      sig.fps,
      { start: sig.start, end: sig.end },
    )
    if (session !== videoNoteCountSession) return

    videoNoteCountCache = countNoteEvents(frames)
    videoNoteCountParams = { ...sig }
    midiNotesCountEl.textContent = String(videoNoteCountCache)

    await seekVideo(video, savedScrubTime)
    if (session !== videoNoteCountSession) return
    refreshGrid({ skipMidiNotes: true })
  } catch {
    if (session === videoNoteCountSession) midiNotesCountEl.textContent = "—"
  }
}

const scheduleVideoMidiNotesCount = () => {
  if (videoNoteCountDebounce !== null) clearTimeout(videoNoteCountDebounce)
  videoNoteCountDebounce = setTimeout(() => {
    videoNoteCountDebounce = null
    void computeVideoMidiNotesCount()
  }, 200)
}

const updateMidiNotesReadout = () => {
  if (!midiNotesCountEl) return

  if (!media || !currentGrid) {
    midiNotesCountEl.textContent = "—"
    return
  }

  if (media.kind === "image") {
    midiNotesCountEl.textContent = String(countNoteEvents([currentGrid]))
    return
  }

  if (previewPlaying) {
    if (videoNoteCountCache !== null) {
      midiNotesCountEl.textContent = String(videoNoteCountCache)
    }
    return
  }

  const sig = videoNoteCountSignature()
  if (
    videoNoteCountCache !== null &&
    videoNoteCountSignaturesMatch(sig, videoNoteCountParams)
  ) {
    midiNotesCountEl.textContent = String(videoNoteCountCache)
    return
  }

  midiNotesCountEl.textContent = "…"
  scheduleVideoMidiNotesCount()
}

const updateExportStatus = () => {
  updateMidiNotesReadout()
  if (!currentGrid) {
    exportStatus.textContent = ""
    return
  }
  const blocks = countNoteEvents([currentGrid])
  if (blocks === 0) {
    exportStatus.textContent =
      "No lit blocks — lower threshold, enable invert, or check the preview before exporting."
  } else {
    exportStatus.textContent = `${blocks} MIDI block${blocks === 1 ? "" : "s"} in this frame.`
  }
}

const refreshGrid = (options = {}) => {
  const source = activeSource()
  if (!source) return
  currentLumas = sampleSourceLuma(source)
  if (!currentLumas) {
    currentGrid = null
    if (exportVideoMidiBtn) exportVideoMidiBtn.disabled = true
    exportStatus.textContent = "Could not read this file’s pixels (missing dimensions)."
    if (!options.skipMidiNotes) updateMidiNotesReadout()
    return
  }

  if (options.autoThreshold) {
    const auto = otsuThreshold(currentLumas)
    thresholdInput.value = String(auto)
    thresholdValue.textContent = String(auto)
  }

  const threshold = Number(thresholdInput.value)
  const invert = invertInput.checked
  currentGrid = lumaToGrid(currentLumas, threshold, invert)
  const scale = Number(scaleInput.value)
  drawGrid(preview, currentGrid, scale)
  if (exportVideoMidiBtn) {
    exportVideoMidiBtn.disabled = media?.kind !== "video" || previewPlaying
  }
  previewPlaybackBtn.disabled = media?.kind !== "video" || previewPlaying
  previewResetStartBtn.disabled = media?.kind !== "video"
  if (options.skipMidiNotes) return
  updateExportStatus()
}

const loadFile = async (file) => {
  if (!file) return
  await revokeMedia()
  const url = URL.createObjectURL(file)
  const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name)

  if (isVideo) {
    const video = document.createElement("video")
    video.src = url
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    await new Promise((resolve, reject) => {
      video.addEventListener("loadedmetadata", resolve, { once: true })
      video.addEventListener("error", reject, { once: true })
    })
    media = { kind: "video", url, name: file.name, video }
    videoTimeline.hidden = false
    exportFpsInput.value = String(DEFAULT_EXPORT_FPS)
    exportFpsValue.textContent = String(DEFAULT_EXPORT_FPS)
    if (exportVideoMidiBtn) exportVideoMidiBtn.hidden = false
    previewPlaybackBtn.disabled = false
    previewResetStartBtn.disabled = false
    frameInput.min = "0"
    frameInput.max = String(Math.max(0, video.duration))
    frameInput.value = "0"
    updateTimelineReadouts(0)
    video.currentTime = 0
    await new Promise((resolve) => {
      video.addEventListener("seeked", resolve, { once: true })
    })
    resetExportFrameRange(video)
  } else {
    const image = new Image()
    image.src = url
    await image.decode()
    media = { kind: "image", url, name: file.name, image }
    videoTimeline.hidden = true
  }

  fileNameEl.textContent = file.name
  refreshGrid({ autoThreshold: true })
}

const pickFiles = (files) => {
  const file = files?.[0]
  if (file) loadFile(file)
}

dropzone.addEventListener("click", () => fileInput.click())
fileInput.addEventListener("change", () => pickFiles(fileInput.files))

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault()
  dropzone.classList.add("is-dragover")
})
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"))
dropzone.addEventListener("drop", (event) => {
  event.preventDefault()
  dropzone.classList.remove("is-dragover")
  pickFiles(event.dataTransfer?.files)
})

thresholdInput.addEventListener("input", () => {
  thresholdValue.textContent = thresholdInput.value
  refreshGrid()
})

const syncScaleAria = () => {
  scaleInput.setAttribute("aria-valuetext", `${scaleInput.value}×`)
}

scaleInput.addEventListener("input", () => {
  syncScaleAria()
  const scale = Number(scaleInput.value)
  if (currentGrid) drawGrid(preview, currentGrid, scale)
})

syncScaleAria()

invertInput.addEventListener("change", () => refreshGrid())

frameInput.addEventListener("input", async () => {
  if (!media?.video || previewPlaying) return
  const time = Number(frameInput.value)
  updateTimelineReadouts(time)
  media.video.currentTime = time
  await new Promise((resolve) => {
    media.video.addEventListener("seeked", resolve, { once: true })
  })
  refreshGrid()
})

exportFrameStart.addEventListener("input", () => {
  syncExportFrameHandles("start")
  void previewAtExportFrame(Number(exportFrameStart.value))
})
exportFrameEnd.addEventListener("input", () => {
  syncExportFrameHandles("end")
  void previewAtExportFrame(Number(exportFrameEnd.value))
})

exportRangeRail?.addEventListener(
  "click",
  (event) => {
    if (previewPlaying) return
    if (
      event.target instanceof HTMLInputElement &&
      event.target.classList.contains("video-trimmer-export")
    ) {
      return
    }
    const time = timeFromTimelineClientX(event.clientX)
    if (time === null) return
    void scrubToTime(time)
  },
  true,
)

exportFpsInput.addEventListener("input", () => {
  const fps = getExportFps()
  exportFpsValue.textContent = String(fps)
  const video = media?.video
  if (!video) return
  rescaleExportFrameRange(video, lastExportFps, fps)
  lastExportFps = fps
})

previewPlaybackBtn.addEventListener("click", () => {
  void togglePreviewPlayback()
})

previewResetStartBtn.addEventListener("click", () => {
  void resetPreviewToStart()
})

exportVideoMidiBtn?.addEventListener("click", async () => {
  const video = media?.video
  if (!video) return

  await stopPreviewPlayback()

  const threshold = Number(thresholdInput.value)
  const invert = invertInput.checked
  const fps = getExportFps()
  const base = media.name.replace(/\.[^.]+$/, "")
  const exportRange = getExportFrameRange()
  const exportCount = exportRange.end - exportRange.start + 1

  if (exportVideoMidiBtn) exportVideoMidiBtn.disabled = true
  exportStatus.textContent = `Sampling video for MIDI (0/${exportCount} frames)…`

  try {
    const frames = await sampleVideoGrids(
      video,
      threshold,
      invert,
      fps,
      exportRange,
      (done, total) => {
        exportStatus.textContent = `Sampling video for MIDI (${done}/${total} frames)…`
      },
    )

    if (frames.length === 0) {
      exportStatus.textContent = "Could not sample this video (missing duration)."
      return
    }

    if (countNoteEvents(frames) === 0) {
      exportStatus.textContent =
        "Export blocked: no lit blocks in any frame. Adjust threshold or invert."
      return
    }

    downloadMidi(frames, `${base}-video.mid`, midiExportOptions({ videoFps: fps }))
    exportStatus.textContent = `Exported frames ${exportRange.start}–${exportRange.end} (${frames.length} at ${fps} FPS, ${getBpm()} BPM).`
    frameInput.value = String(video.currentTime)
    updateTimelineReadouts(video.currentTime)
    refreshGrid()
  } catch {
    exportStatus.textContent = "Video MIDI export failed while seeking frames."
  } finally {
    if (exportVideoMidiBtn) exportVideoMidiBtn.disabled = false
    updateExportStatus()
  }
})

// Empty grid placeholder
drawGrid(preview, new Uint8Array(GRID_W * GRID_H), Number(scaleInput.value))
