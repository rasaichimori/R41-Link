import {
  DEFAULT_BPM,
  DEFAULT_EXPORT_FPS,
  DEFAULT_TICKS_PER_FRAME,
  MAX_BPM,
  MAX_EXPORT_FPS,
  MIN_BPM,
  MIN_EXPORT_FPS,
} from "./constants"
import type { ConsoleLog } from "./consoleLog.svelte"
import { countNoteEvents, downloadMidi } from "./midi"
import { lumaToGrid, otsuThreshold, sampleSourceLuma } from "./raster"
import { clampToVideo, exportFrameTotal, loadVideo, sampleVideoGrids, seekVideo, type FrameRange } from "./video"

type Media =
  | { kind: "image"; url: string; name: string; image: HTMLImageElement }
  | { kind: "video"; url: string; name: string; video: HTMLVideoElement }

type PreviewParams = { fps: number; exportRange: FrameRange }

type NoteCountSignature = {
  threshold: number
  invert: boolean
  fps: number
  start: number
  end: number
  mediaUrl: string
}

type RefreshOptions = { autoThreshold?: boolean; skipMidiNotes?: boolean; reuseLuma?: boolean }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const signaturesMatch = (a: NoteCountSignature | null, b: NoteCountSignature | null) =>
  Boolean(a && b) &&
  a!.threshold === b!.threshold &&
  a!.invert === b!.invert &&
  a!.fps === b!.fps &&
  a!.start === b!.start &&
  a!.end === b!.end &&
  a!.mediaUrl === b!.mediaUrl

const isVideoFile = (file: File) => file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name)

/** Media → 26×27 grid conversion, range preview playback and MIDI export. */
export class Converter {
  media = $state.raw<Media | null>(null)
  fileName = $state<string | null>(null)
  threshold = $state(128)
  invert = $state(false)
  scale = $state(16)
  bpmInput = $state<number | null>(DEFAULT_BPM)
  fpsInput = $state(DEFAULT_EXPORT_FPS)
  /** Scrub position in seconds */
  scrubTime = $state(0)
  /** Export frame shown in the "Frame" readout */
  currentFrame = $state(0)
  /** Raw trim handle positions; either one may be dragged past the other */
  handleStart = $state(0)
  handleEnd = $state(0)
  frameMax = $state(0)
  grid = $state.raw<Uint8Array | null>(null)
  status = $state("")
  notesText = $state("—")
  playing = $state(false)
  exporting = $state(false)

  video = $derived(this.media?.kind === "video" ? this.media.video : null)
  duration = $derived(this.video && Number.isFinite(this.video.duration) ? this.video.duration : 0)
  fps = $derived(
    Number.isFinite(this.fpsInput) ? clamp(Math.round(this.fpsInput), MIN_EXPORT_FPS, MAX_EXPORT_FPS) : DEFAULT_EXPORT_FPS,
  )
  bpm = $derived.by(() => {
    const n = Number(this.bpmInput)
    return Number.isFinite(n) ? clamp(Math.round(n), MIN_BPM, MAX_BPM) : DEFAULT_BPM
  })
  range = $derived<FrameRange>({
    start: Math.min(this.handleStart, this.handleEnd),
    end: Math.max(this.handleStart, this.handleEnd),
  })
  playheadRatio = $derived(this.duration > 0 ? clamp(this.scrubTime / this.duration, 0, 1) : 0)
  rangeStartRatio = $derived(this.frameMax > 0 ? this.range.start / this.frameMax : 0)
  rangeEndRatio = $derived(this.frameMax > 0 ? (this.frameMax - this.range.end) / this.frameMax : 0)
  rangeSummary = $derived.by(() => {
    if (!this.video) return "Open a video to choose a range."
    const count = Math.max(0, this.range.end - this.range.start + 1)
    return `${count.toLocaleString()} frame${count === 1 ? "" : "s"} selected (${(count / this.fps).toFixed(1)} s at ${this.fps} fps)`
  })
  exportDisabled = $derived(!this.video || this.playing || this.exporting || !this.grid)

  #log: ConsoleLog
  #lumas: Uint8Array | null = null
  #lastExportFps = DEFAULT_EXPORT_FPS

  #previewAnimFrame: number | null = null
  #previewSession = 0
  #previewStartPerf = 0
  #previewDisplayedFrame = -1
  #previewSeekInFlight = false
  #previewStartFrame = 0
  #previewParams: PreviewParams | null = null

  #noteCountCache: number | null = null
  #noteCountParams: NoteCountSignature | null = null
  #noteCountSession = 0
  #noteCountDebounce: ReturnType<typeof setTimeout> | null = null

  constructor(log: ConsoleLog) {
    this.#log = log
  }

  /* ───────────── Inputs ───────────── */

  pickFiles = (files: FileList | null | undefined) => {
    const file = files?.[0]
    if (file) void this.loadFile(file)
  }

  setThreshold = (value: number) => {
    this.threshold = value
    if (this.playing) {
      this.#regrid()
      return
    }
    this.#invalidateNoteCount()
    this.#refreshGrid({ skipMidiNotes: true, reuseLuma: true })
  }

  commitThreshold = () => {
    if (this.playing) return
    this.#updateExportStatus()
  }

  setInvert = (value: boolean) => {
    this.invert = value
    if (this.playing) {
      this.#regrid()
      return
    }
    this.#invalidateNoteCount()
    this.#refreshGrid({ skipMidiNotes: true, reuseLuma: true })
    this.#updateExportStatus()
  }

  setFps = (value: number) => {
    this.fpsInput = value
    const fps = this.fps
    const video = this.video
    if (!video) return
    this.#rescaleExportFrameRange(video, this.#lastExportFps, fps)
    this.#lastExportFps = fps
    if (this.playing) {
      this.#syncPreviewParams()
      void this.#restartPreviewFrom(this.#timeToFrame(this.scrubTime, fps))
    }
  }

  setHandle = (active: "start" | "end", value: number) => {
    if (active === "start") {
      this.handleStart = value
      if (value > this.handleEnd) this.handleEnd = value
    } else {
      this.handleEnd = value
      if (value < this.handleStart) this.handleStart = value
    }
    this.#onRangeChanged()
    if (this.playing) this.#syncPreviewParams()
    void this.#previewAtFrame(value)
  }

  /** Seek to `time` seconds; while previewing, playback continues from there. */
  scrubToTime = async (time: number) => {
    const video = this.video
    if (!video) return
    const t = clampToVideo(video, time)
    const frameIndex = this.#timeToFrame(t)
    this.#updateTimelineReadouts(t, frameIndex)
    if (this.playing) {
      await this.#restartPreviewFrom(frameIndex)
      return
    }
    try {
      await seekVideo(video, t)
      this.#refreshGrid()
    } catch {
      this.#setStatus("Could not seek video for this frame.")
    }
  }

  /* ───────────── Loading ───────────── */

  loadFile = async (file: File) => {
    this.#revokeMedia()
    const url = URL.createObjectURL(file)

    try {
      if (isVideoFile(file)) {
        const video = await loadVideo(url)
        this.media = { kind: "video", url, name: file.name, video }
        this.fpsInput = DEFAULT_EXPORT_FPS
        this.#updateTimelineReadouts(0)
        video.currentTime = 0
        await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }))
        this.#resetExportFrameRange(video)
      } else {
        const image = new Image()
        image.src = url
        await image.decode()
        this.media = { kind: "image", url, name: file.name, image }
      }
    } catch {
      URL.revokeObjectURL(url)
      this.media = null
      this.#setStatus(`Could not open ${file.name}.`)
      return
    }

    this.fileName = file.name
    this.#log.command(`load ${file.name}`)
    this.#refreshGrid({ autoThreshold: true })
  }

  #revokeMedia = () => {
    this.#stopPreview()
    if (this.media?.url) URL.revokeObjectURL(this.media.url)
    this.media = null
    this.grid = null
    this.#lumas = null
    this.#invalidateNoteCount()
    this.#setStatus("")
    this.#updateMidiNotesReadout()
  }

  #activeSource = () => {
    if (!this.media) return null
    return this.media.kind === "video" ? this.media.video : this.media.image
  }

  /* ───────────── Grid + status ───────────── */

  #setStatus = (text: string) => {
    this.status = text
    if (text.trim()) this.#log.add(text.trim(), { merge: true })
  }

  /** Re-threshold the cached frame lumas (no video seek); used while range preview is playing. */
  #regrid = () => {
    if (!this.#lumas) return
    this.grid = lumaToGrid(this.#lumas, this.threshold, this.invert)
  }

  #refreshGrid = (options: RefreshOptions = {}) => {
    const source = this.#activeSource()
    if (!source) return
    if (!(options.reuseLuma && this.#lumas)) {
      this.#lumas = sampleSourceLuma(source)
    }
    if (!this.#lumas) {
      this.grid = null
      this.#setStatus("Could not read this file’s pixels (missing dimensions).")
      if (!options.skipMidiNotes) this.#updateMidiNotesReadout()
      return
    }

    if (options.autoThreshold) this.threshold = otsuThreshold(this.#lumas)

    this.#regrid()
    if (options.skipMidiNotes) return
    this.#updateExportStatus()
  }

  #updateExportStatus = () => {
    this.#updateMidiNotesReadout()
    if (!this.grid) {
      this.#setStatus("")
      return
    }
    const blocks = countNoteEvents([this.grid])
    if (blocks === 0) {
      this.#setStatus("No lit blocks — lower threshold, enable invert, or check the preview before exporting.")
    } else {
      this.#setStatus(`${blocks} MIDI block${blocks === 1 ? "" : "s"} in this frame.`)
    }
  }

  /* ───────────── Timeline ───────────── */

  #timeToFrame = (seconds: number, fps = this.fps) => {
    const cap = Number.isFinite(this.frameMax) && this.frameMax >= 0 ? this.frameMax : 0
    const t = Math.max(0, Number(seconds) || 0)
    return Math.min(cap, Math.max(0, Math.floor(t * fps)))
  }

  /** `frameOverride` is the export frame index when it is already known (preview). */
  #updateTimelineReadouts = (seconds = this.scrubTime, frameOverride?: number) => {
    const video = this.video
    let sec = Number.isFinite(seconds) ? seconds : 0
    if (video && this.duration > 0) {
      sec = clampToVideo(video, sec)
      this.scrubTime = sec
    }
    this.currentFrame = frameOverride ?? this.#timeToFrame(sec)
  }

  #onRangeChanged = () => {
    this.#updateTimelineReadouts()
    this.#invalidateNoteCount()
    this.#updateMidiNotesReadout()
  }

  #setExportFrameRangeBounds = (video: HTMLVideoElement, fps = this.fps) => {
    this.frameMax = exportFrameTotal(video.duration, fps) - 1
    return this.frameMax
  }

  #resetExportFrameRange = (video: HTMLVideoElement) => {
    const max = this.#setExportFrameRangeBounds(video)
    this.handleStart = 0
    this.handleEnd = max
    this.#lastExportFps = this.fps
    this.#onRangeChanged()
  }

  #rescaleExportFrameRange = (video: HTMLVideoElement, oldFps: number, newFps: number) => {
    const { start, end } = this.range
    const timeStart = start / oldFps
    const timeEnd = (end + 1) / oldFps
    const max = this.#setExportFrameRangeBounds(video, newFps)
    const newStart = Math.min(max, Math.max(0, Math.floor(timeStart * newFps)))
    const newEnd = Math.min(max, Math.max(newStart, Math.ceil(timeEnd * newFps) - 1))
    this.handleStart = newStart
    this.handleEnd = newEnd
    this.#onRangeChanged()
  }

  #previewAtFrame = async (frameIndex: number) => {
    const video = this.video
    if (!video) return
    const t = clampToVideo(video, frameIndex / this.fps)
    this.#updateTimelineReadouts(t, frameIndex)
    if (this.playing) {
      await this.#restartPreviewFrom(frameIndex)
      return
    }
    try {
      await seekVideo(video, t)
      this.#refreshGrid()
    } catch {
      this.#setStatus("Could not preview this export frame.")
    }
  }

  /* ───────────── Range preview playback ───────────── */

  togglePlayback = async () => {
    if (!this.video) return

    if (this.playing) {
      this.#stopPreview()
      this.#refreshGrid()
      this.#updateExportStatus()
      return
    }

    this.playing = true
    this.#syncPreviewParams()
    await this.#startPreviewAnimation()
  }

  resetToStart = async () => {
    const video = this.video
    if (!video) return
    if (this.playing) this.#stopPreview()

    const { start } = this.range
    const t = clampToVideo(video, start / this.fps)
    this.#updateTimelineReadouts(t, start)
    try {
      await seekVideo(video, t)
      this.#refreshGrid()
      this.#updateExportStatus()
    } catch {
      this.#setStatus("Could not reset preview to start.")
    }
  }

  #syncPreviewParams = () => {
    this.#previewParams = { fps: this.fps, exportRange: this.range }
  }

  #cancelPreviewAnimationFrame = () => {
    if (this.#previewAnimFrame === null) return
    cancelAnimationFrame(this.#previewAnimFrame)
    this.#previewAnimFrame = null
  }

  #stopPreview = () => {
    this.playing = false
    this.#previewSession += 1
    this.#cancelPreviewAnimationFrame()
    this.#previewSeekInFlight = false
    this.#previewParams = null
    this.#previewDisplayedFrame = -1
  }

  #finishPreview = () => {
    const range = this.#previewParams?.exportRange
    if (range) this.#setStatus(`Preview finished (frames ${range.start}–${range.end}).`)
    this.#stopPreview()
    this.#refreshGrid()
    this.#updateExportStatus()
  }

  #renderPreviewFrame = async (frameIndex: number, session: number) => {
    const params = this.#previewParams
    const video = this.video
    if (!this.playing || session !== this.#previewSession || !params || !video) return false

    const { fps, exportRange } = params
    try {
      const t = clampToVideo(video, frameIndex / fps)
      await seekVideo(video, t)
      if (!this.playing || session !== this.#previewSession) return false
      this.#lumas = sampleSourceLuma(video)
      if (!this.#lumas) return false
      this.#regrid()
      this.#setStatus(`Previewing export frame ${frameIndex} of ${exportRange.start}–${exportRange.end}…`)
      this.#previewDisplayedFrame = frameIndex
      this.#updateTimelineReadouts(t, frameIndex)
      return true
    } catch {
      this.#setStatus("Preview stopped (video seek failed).")
      this.#stopPreview()
      this.#refreshGrid()
      return false
    }
  }

  #onPreviewAnimationFrame = (timestamp: number) => {
    if (!this.playing) return

    const session = this.#previewSession
    const params = this.#previewParams
    if (!params || !this.video) {
      this.#stopPreview()
      return
    }

    const { fps, exportRange } = params
    const elapsedSec = (timestamp - this.#previewStartPerf) / 1000
    const frameIndex = this.#previewStartFrame + Math.floor(elapsedSec * fps)

    if (frameIndex > exportRange.end) {
      this.#finishPreview()
      return
    }

    if (!this.#previewSeekInFlight && frameIndex > this.#previewDisplayedFrame) {
      this.#previewSeekInFlight = true
      void this.#renderPreviewFrame(frameIndex, session).finally(() => {
        this.#previewSeekInFlight = false
      })
    }

    this.#previewAnimFrame = requestAnimationFrame(this.#onPreviewAnimationFrame)
  }

  /** Show `frame` now, then keep advancing in real time from there. */
  #playFrom = async (frame: number) => {
    this.#previewStartFrame = frame
    this.#previewStartPerf = performance.now()
    this.#previewDisplayedFrame = frame - 1

    const session = this.#previewSession
    this.#previewSeekInFlight = true
    await this.#renderPreviewFrame(frame, session)
    this.#previewSeekInFlight = false

    if (!this.playing || session !== this.#previewSession) return
    if (this.#previewAnimFrame === null) {
      this.#previewAnimFrame = requestAnimationFrame(this.#onPreviewAnimationFrame)
    }
  }

  #startPreviewAnimation = async () => {
    this.#cancelPreviewAnimationFrame()
    const params = this.#previewParams
    if (!params) return
    const { start, end } = params.exportRange
    await this.#playFrom(clamp(this.#timeToFrame(this.scrubTime, params.fps), start, end))
  }

  /** While range preview is playing, jump the playhead and keep advancing from there. */
  #restartPreviewFrom = async (frameIndex: number) => {
    if (!this.playing || !this.video) return
    this.#syncPreviewParams()
    const range = this.#previewParams?.exportRange
    if (!range) return
    await this.#playFrom(clamp(frameIndex, range.start, range.end))
  }

  /* ───────────── MIDI note count ───────────── */

  #noteCountSignature = (): NoteCountSignature | null => {
    if (!this.media || !this.video) return null
    const { start, end } = this.range
    return {
      threshold: this.threshold,
      invert: this.invert,
      fps: this.fps,
      start,
      end,
      mediaUrl: this.media.url,
    }
  }

  #invalidateNoteCount = () => {
    this.#noteCountSession += 1
    this.#noteCountCache = null
    this.#noteCountParams = null
    if (this.#noteCountDebounce !== null) {
      clearTimeout(this.#noteCountDebounce)
      this.#noteCountDebounce = null
    }
  }

  #computeVideoNoteCount = async () => {
    const video = this.video
    if (!video || this.playing) return

    const sig = this.#noteCountSignature()
    if (!sig) return

    const session = ++this.#noteCountSession
    this.notesText = "…"

    const savedScrubTime = this.scrubTime

    try {
      const frames = await sampleVideoGrids(video, sig.threshold, sig.invert, sig.fps, {
        start: sig.start,
        end: sig.end,
      })
      if (session !== this.#noteCountSession) {
        try {
          await seekVideo(video, savedScrubTime)
        } catch {
          /* superseded run left the video elsewhere; restore scrub time */
        }
        return
      }

      this.#noteCountCache = countNoteEvents(frames)
      this.#noteCountParams = { ...sig }
      this.notesText = String(this.#noteCountCache)

      await seekVideo(video, savedScrubTime)
      if (session !== this.#noteCountSession) return
      this.#refreshGrid({ skipMidiNotes: true, reuseLuma: true })
    } catch {
      if (session === this.#noteCountSession) this.notesText = "—"
      try {
        await seekVideo(video, savedScrubTime)
      } catch {
        /* ignore */
      }
    }
  }

  #scheduleVideoNoteCount = () => {
    if (this.#noteCountDebounce !== null) clearTimeout(this.#noteCountDebounce)
    this.#noteCountDebounce = setTimeout(() => {
      this.#noteCountDebounce = null
      void this.#computeVideoNoteCount()
    }, 200)
  }

  #updateMidiNotesReadout = () => {
    if (!this.media || !this.grid) {
      this.notesText = "—"
      return
    }

    if (this.media.kind === "image") {
      this.notesText = String(countNoteEvents([this.grid]))
      return
    }

    if (this.playing) {
      if (this.#noteCountCache !== null) this.notesText = String(this.#noteCountCache)
      return
    }

    if (this.#noteCountCache !== null && signaturesMatch(this.#noteCountSignature(), this.#noteCountParams)) {
      this.notesText = String(this.#noteCountCache)
      return
    }

    this.notesText = "…"
    this.#scheduleVideoNoteCount()
  }

  /* ───────────── Export ───────────── */

  #midiOptions = (videoFps: number) => ({
    bpm: this.bpm,
    ticksPerFrame: videoFps ? Math.max(1, Math.round((480 * 60) / (this.bpm * videoFps))) : DEFAULT_TICKS_PER_FRAME,
  })

  exportMidi = async () => {
    const media = this.media
    const video = this.video
    if (!media || !video) return

    this.#stopPreview()

    const { threshold, invert, fps } = this
    const base = media.name.replace(/\.[^.]+$/, "")
    const exportRange = this.range
    const exportCount = exportRange.end - exportRange.start + 1

    this.exporting = true
    this.#setStatus(`Sampling video for MIDI (0/${exportCount} frames)…`)

    try {
      const frames = await sampleVideoGrids(video, threshold, invert, fps, exportRange, (done, total) => {
        this.#setStatus(`Sampling video for MIDI (${done}/${total} frames)…`)
      })

      if (frames.length === 0) {
        this.#setStatus("Could not sample this video (missing duration).")
        return
      }

      if (countNoteEvents(frames) === 0) {
        this.#setStatus("Export blocked: no lit blocks in any frame. Adjust threshold or invert.")
        return
      }

      downloadMidi(frames, `${base}-video.mid`, this.#midiOptions(fps))
      this.#setStatus(
        `Exported frames ${exportRange.start}–${exportRange.end} (${frames.length} at ${fps} FPS, ${this.bpm} BPM).`,
      )
      this.#updateTimelineReadouts(video.currentTime)
      this.#refreshGrid()
    } catch {
      this.#setStatus("Video MIDI export failed while seeking frames.")
    } finally {
      this.exporting = false
      this.#updateExportStatus()
    }
  }
}
