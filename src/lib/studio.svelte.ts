import { flushSync } from "svelte"
import type { Attachment } from "svelte/attachments"
import { GRID_SIZE, GRID_H, GRID_W } from "./constants"
import { countNoteEvents, downloadMidi } from "./midi"
import type { SchemeSetting } from "./scheme.svelte"

export type StudioTool = "pencil" | "eraser" | "auto"

type Frame = Uint8Array
type Cell = { x: number; y: number }
type Snapshot = { frames: Frame[]; current: number }
type ContextMenu = { x: number; y: number; index: number }

const W = GRID_W
const H = GRID_H
const SIZE = GRID_SIZE
const STORE_KEY = "r41-animation-studio"
const HINT = "Draw on the display. Drag frames on the timeline to move them; right-click a frame for copy and paste."
const RULER_H = 23

const blank = (): Frame => new Uint8Array(SIZE)
const clone = (frame: Frame) => frame.slice()

const clampInt = (value: string | number, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const packFrame = (frame: Frame) => {
  const bytes = new Uint8Array(Math.ceil(SIZE / 8))
  for (let i = 0; i < SIZE; i += 1) if (frame[i]) bytes[i >> 3] |= 1 << (i & 7)
  return btoa(String.fromCharCode(...bytes))
}

const unpackFrame = (text: string) => {
  const frame = blank()
  const bytes = atob(text)
  for (let i = 0; i < SIZE; i += 1) frame[i] = (bytes.charCodeAt(i >> 3) >> (i & 7)) & 1
  return frame
}

const hasInk = (frame: Frame) => frame.some((value) => value === 1)

/**
 * Frame-by-frame on/off pixel animation for the R41's 26×27 LCD.
 * Behavior matches the Animation Studio page: drawing, onion skin, timeline edits, and MIDI export.
 */
export class Studio {
  frames = $state<Frame[]>([blank()])
  current = $state(0)
  tool = $state<StudioTool>("pencil")
  onion = $state(true)
  onionCount = $state(2)
  onionNext = $state(false)
  grid = $state(true)
  blocks = $state(false)
  loop = $state(true)
  fps = $state(12)
  bpm = $state(120)
  playing = $state(false)
  /** Empty shows the resting hint. */
  status = $state("")
  cursor = $state<Cell | null>(null)
  erasing = $state(false)
  canUndo = $state(false)
  canRedo = $state(false)
  clipboardEmpty = $state(true)
  /** Bumps when frame pixels change so the stage repaints. */
  paintSerial = $state(0)
  /** Bumps when the timeline's frame chips need to refresh. */
  tick = $state(0)
  slots = $state(31)
  cell = $state(16)
  addHover = $state(-1)
  moving = $state(false)
  /** Pixel offset of the drop marker, or null when it is hidden. */
  dropLeft = $state<number | null>(null)
  context = $state<ContextMenu | null>(null)
  keysOpen = $state(false)
  aboutOpen = $state(false)

  selStart = $state(0)
  selEnd = $state(0)

  tlScroll: HTMLElement | null = null
  contextEl: HTMLDivElement | null = null

  showKeys = () => {}
  showAbout = () => {}

  #anchor = 0
  #clipboard: Frame[] = []
  #undo: Snapshot[] = []
  #redo: Snapshot[] = []
  #saveTimer = 0
  #playRaf = 0
  #playFrom = 0
  #playStart: number | null = null
  #contextReturn: HTMLElement | null = null

  constructor(private scheme: SchemeSetting) {
    const restored = this.#load()
    this.status = restored ? `Restored your animation (${this.frames.length} frames).` : ""
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", () => {
      this.paintSerial += 1
    })
  }

  get statusText() {
    return this.status || HINT
  }

  get selCount() {
    return this.selEnd - this.selStart + 1
  }

  get notesLabel() {
    void this.tick
    return countNoteEvents(this.frames).toLocaleString()
  }

  get frameReadout() {
    return this.selCount > 1
      ? `Frames ${this.selStart + 1}–${this.selEnd + 1} of ${this.frames.length}`
      : `Frame ${this.current + 1} of ${this.frames.length}`
  }

  get positionText() {
    return this.cursor ? `x ${this.cursor.x}, y ${this.cursor.y}` : "\u00a0"
  }

  get timeReadout() {
    return `${(this.current / this.fps).toFixed(1)}s`
  }

  inkAt = (index: number) => {
    void this.tick
    const frame = this.frames[index]
    return frame ? hasInk(frame) : false
  }

  isSelected = (index: number) => index >= this.selStart && index <= this.selEnd

  rangeLabel = (a: number, b: number) => (a === b ? `frame ${a + 1}` : `frames ${a + 1}–${b + 1}`)

  /* ───────────── History and storage ───────────── */

  #snapshot = (): Snapshot => ({ frames: this.frames.map(clone), current: this.current })

  #syncHistory = () => {
    this.canUndo = this.#undo.length > 0
    this.canRedo = this.#redo.length > 0
  }

  pushHistory = () => {
    this.#undo.push(this.#snapshot())
    if (this.#undo.length > 200) this.#undo.shift()
    this.#redo.length = 0
    this.#syncHistory()
  }

  #restore = (snap: Snapshot) => {
    this.frames = snap.frames
    this.#collapse(Math.min(snap.current, this.frames.length - 1))
    this.#touch(true)
    this.save()
  }

  undo = () => {
    const snap = this.#undo.pop()
    if (!snap) return
    this.stop()
    this.#redo.push(this.#snapshot())
    this.#syncHistory()
    this.#restore(snap)
    this.status = "Undo."
  }

  redo = () => {
    const snap = this.#redo.pop()
    if (!snap) return
    this.stop()
    this.#undo.push(this.#snapshot())
    this.#syncHistory()
    this.#restore(snap)
    this.status = "Redo."
  }

  save = () => {
    window.clearTimeout(this.#saveTimer)
    this.#saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORE_KEY,
          JSON.stringify({
            v: 1,
            frames: this.frames.map(packFrame),
            current: this.current,
            tool: this.tool,
            onion: this.onion,
            onionCount: this.onionCount,
            onionNext: this.onionNext,
            grid: this.grid,
            blocks: this.blocks,
            loop: this.loop,
            fps: this.fps,
            bpm: this.bpm,
          }),
        )
      } catch {
        /* storage unavailable */
      }
    }, 300)
  }

  #load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as {
        v?: number
        frames?: unknown
        current?: number
        tool?: string
        onion?: boolean
        onionCount?: number
        onionNext?: boolean
        grid?: boolean
        blocks?: boolean
        loop?: boolean
        fps?: number
        bpm?: number
      } | null
      if (!data || data.v !== 1 || !Array.isArray(data.frames) || data.frames.length === 0) return false
      this.frames = data.frames.map((text) => unpackFrame(String(text)))
      this.#collapse(clampInt(data.current ?? 0, 0, this.frames.length - 1, 0))
      if (data.tool === "pencil" || data.tool === "eraser" || data.tool === "auto") this.tool = data.tool
      this.onion = data.onion !== false
      this.onionCount = clampInt(data.onionCount ?? 2, 1, 8, 2)
      this.onionNext = Boolean(data.onionNext)
      this.grid = data.grid !== false
      this.blocks = Boolean(data.blocks)
      this.loop = data.loop !== false
      this.fps = clampInt(data.fps ?? 12, 1, 60, 12)
      this.bpm = clampInt(data.bpm ?? 120, 1, 999, 120)
      return true
    } catch {
      return false
    }
  }

  /* ───────────── Selection and playback position ───────────── */

  #collapse = (index = this.current) => {
    this.current = index
    this.selStart = index
    this.selEnd = index
    this.#anchor = index
    this.ensureVisible()
  }

  selectOnly = (index: number) => {
    this.#collapse(index)
  }

  extendTo = (index: number) => {
    this.current = index
    this.selStart = Math.min(this.#anchor, index)
    this.selEnd = Math.max(this.#anchor, index)
    this.ensureVisible()
  }

  #selectRange = (start: number, end: number, current = start) => {
    this.selStart = start
    this.selEnd = end
    this.#anchor = start
    this.current = current
    this.ensureVisible()
  }

  ensureVisible = () => {
    const scroller = this.tlScroll
    if (!scroller) return
    const x = this.current * this.cell
    if (x < scroller.scrollLeft) scroller.scrollLeft = x - this.cell
    else if (x + this.cell > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = x + 2 * this.cell - scroller.clientWidth
    }
  }

  #touch = (timeline = false) => {
    this.paintSerial += 1
    if (timeline) this.tick += 1
  }

  refreshSelection = () => {
    this.#touch(true)
    this.ensureVisible()
    this.save()
  }

  goTo = (index: number) => {
    const count = this.frames.length
    const next = this.loop ? ((index % count) + count) % count : Math.min(count - 1, Math.max(0, index))
    this.#collapse(next)
    this.#touch(true)
    this.save()
  }

  jump = (index: number) => {
    this.stop()
    this.#collapse(Math.min(this.frames.length - 1, Math.max(0, index)))
    this.#touch(true)
    this.save()
  }

  /* ───────────── Frame edits ───────────── */

  insertBlank = () => {
    this.stop()
    this.pushHistory()
    this.frames.splice(this.current + 1, 0, blank())
    this.#collapse(this.current + 1)
    this.changed(`Added blank frame ${this.current + 1}.`)
  }

  duplicateSelection = () => {
    this.stop()
    this.pushHistory()
    const count = this.selCount
    const offset = this.current - this.selStart
    const copies = this.frames.slice(this.selStart, this.selEnd + 1).map(clone)
    this.frames.splice(this.selEnd + 1, 0, ...copies)
    this.#selectRange(this.selEnd + 1, this.selEnd + count, this.selEnd + 1 + offset)
    this.changed(`Duplicated into ${this.rangeLabel(this.selStart, this.selEnd)}.`)
  }

  deleteSelection = (verb = "Deleted") => {
    this.stop()
    this.pushHistory()
    const { selStart: start, selEnd: end } = this
    this.frames.splice(start, end - start + 1)
    if (this.frames.length === 0) this.frames.push(blank())
    this.#collapse(Math.min(start, this.frames.length - 1))
    this.changed(`${verb} ${this.rangeLabel(start, end)}.`)
  }

  #editFrames = (fn: (value: number) => number, verb: string) => {
    this.stop()
    this.pushHistory()
    for (let frameIndex = this.selStart; frameIndex <= this.selEnd; frameIndex += 1) {
      const frame = this.frames[frameIndex]
      for (let i = 0; i < SIZE; i += 1) frame[i] = fn(frame[i])
    }
    this.changed(`${verb} ${this.rangeLabel(this.selStart, this.selEnd)}.`)
  }

  copyFrames = () => {
    this.#clipboard = this.frames.slice(this.selStart, this.selEnd + 1).map(clone)
    this.clipboardEmpty = false
    this.status = `Copied ${this.rangeLabel(this.selStart, this.selEnd)}. Paste with Ctrl+V, or right-click a frame.`
  }

  cutFrames = () => {
    this.#clipboard = this.frames.slice(this.selStart, this.selEnd + 1).map(clone)
    this.clipboardEmpty = false
    this.deleteSelection("Cut")
  }

  pasteAt = (index: number, mode: "insert" | "replace" = "insert") => {
    if (this.#clipboard.length === 0) {
      this.status = "Nothing copied yet. Select frames and press Ctrl+C first."
      return
    }
    this.stop()
    this.pushHistory()
    const block = this.#clipboard.map(clone)
    let at = index
    if (mode === "replace") {
      at = this.selStart
      this.frames.splice(this.selStart, this.selCount, ...block)
    } else {
      while (this.frames.length < index) this.frames.push(blank())
      this.frames.splice(index, 0, ...block)
    }
    this.#selectRange(at, at + block.length - 1)
    this.changed(
      `Pasted ${block.length === 1 ? "1 frame" : `${block.length} frames`} as ${this.rangeLabel(at, at + block.length - 1)}.`,
    )
  }

  /** Move the selected frames so they start at gap `gap` (0 = before the first frame). */
  moveSelectionTo = (gap: number) => {
    const { selStart: start, selEnd: end } = this
    const count = end - start + 1
    if (gap >= start && gap <= end + 1) return false
    this.stop()
    this.pushHistory()
    const offset = this.current - start
    const block = this.frames.splice(start, count)
    const at = gap > end ? gap - count : gap
    this.frames.splice(at, 0, ...block)
    this.#selectRange(at, at + count - 1, at + offset)
    this.changed(`Moved ${this.rangeLabel(start, end)} to ${this.rangeLabel(at, at + count - 1).replace(/^frames? /, "")}.`)
    return true
  }

  moveBy = (delta: number) => {
    if (delta < 0 && this.selStart > 0) this.moveSelectionTo(this.selStart - 1)
    else if (delta > 0 && this.selEnd < this.frames.length - 1) this.moveSelectionTo(this.selEnd + 2)
  }

  selectAll = () => {
    this.stop()
    this.selStart = 0
    this.selEnd = this.frames.length - 1
    this.#anchor = 0
    this.refreshSelection()
    this.status = `Selected all ${this.frames.length} frames.`
  }

  newAnimation = () => {
    this.stop()
    this.pushHistory()
    this.frames = [blank()]
    this.#collapse(0)
    this.changed("New animation. Undo brings the previous one back.")
  }

  changed = (message?: string) => {
    this.#touch(true)
    this.save()
    if (message) this.status = message
  }

  addFramesTo = (index: number, copy: boolean) => {
    this.stop()
    this.pushHistory()
    const count = this.frames.length
    const last = this.frames[count - 1]
    while (this.frames.length <= index) this.frames.push(copy ? last.slice() : blank())
    this.#collapse(index)
    const added = index - count + 1
    this.addHover = -1
    this.changed(
      added === 1
        ? `Added ${copy ? "a copy as " : ""}frame ${index + 1}.`
        : `Added ${added} ${copy ? "copies" : "blank frames"} (frames ${count + 1}–${index + 1}).`,
    )
  }

  /* ───────────── Tools, onion, export ───────────── */

  setTool = (tool: StudioTool) => {
    this.tool = tool
    if (!this.cursor) this.erasing = tool === "eraser"
    this.paintSerial += 1
    this.status = {
      pencil: "Pencil: click or drag to light pixels.",
      eraser: "Eraser: click or drag to turn pixels off.",
      auto: "Auto: start on a lit pixel to erase, anywhere else to draw.",
    }[tool]
  }

  setOnion = (patch: { onion?: boolean; onionCount?: number; onionNext?: boolean }) => {
    if (patch.onion !== undefined) this.onion = patch.onion
    if (patch.onionCount !== undefined) this.onionCount = patch.onionCount
    if (patch.onionNext !== undefined) this.onionNext = patch.onionNext
    this.paintSerial += 1
    this.save()
  }

  setScheme = (next: string) => {
    this.scheme.set(next)
    requestAnimationFrame(() => {
      this.paintSerial += 1
    })
  }

  setFps = (raw: string) => {
    const fps = clampInt(raw, 1, 60, this.fps)
    if (fps === this.fps) return
    if (this.playing) {
      this.#playFrom = this.current
      this.#playStart = null
    }
    this.fps = fps
    this.save()
  }

  setBpm = (raw: string) => {
    this.bpm = clampInt(raw, 1, 999, this.bpm)
    this.save()
  }

  exportMidi = () => {
    this.stop()
    if (countNoteEvents(this.frames) === 0) {
      this.status = "Export blocked: no lit pixels in any frame. Draw something first."
      return
    }
    const ticksPerFrame = Math.max(1, Math.round((480 * 60) / (this.bpm * this.fps)))
    downloadMidi(this.frames, "animation.mid", { bpm: this.bpm, ticksPerFrame })
    this.status = `Exported ${this.frames.length} frames at ${this.fps} fps, ${this.bpm} BPM.`
  }

  /* ───────────── Drawing ───────────── */

  /** Auto draws, unless the stroke starts on a lit pixel or the button is the right button. */
  strokeValue = (cell: Cell, button = 0) => {
    if (button === 2 || this.tool === "eraser") return 0
    if (this.tool === "auto") return this.frames[this.current][cell.y * W + cell.x] ? 0 : 1
    return 1
  }

  updateCursorMode = (cell: Cell | null) => {
    this.erasing = cell ? this.strokeValue(cell) === 0 : this.tool === "eraser"
  }

  showCursor = (cell: Cell | null) => {
    this.cursor = cell
  }

  cellAt = (event: PointerEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * W)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * H)
    return x >= 0 && y >= 0 && x < W && y < H ? { x, y } : null
  }

  paintLine = (a: Cell, b: Cell, value: number) => {
    const frame = this.frames[this.current]
    let x0 = a.x
    let y0 = a.y
    const x1 = b.x
    const y1 = b.y
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      frame[y0 * W + x0] = value
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
    this.paintSerial += 1
  }

  /** Draws the LCD, including onion-skin ghosts while playback is stopped. */
  paint: Attachment<HTMLCanvasElement> = (canvas) => {
    void this.paintSerial
    void this.current
    void this.playing
    void this.onion
    void this.onionCount
    void this.onionNext
    const stage = canvas.getContext("2d")
    if (!stage) return
    const on = cssVar("--pixel-on")
    const off = cssVar("--pixel-off")
    stage.globalAlpha = 1
    stage.fillStyle = off
    stage.fillRect(0, 0, W, H)

    if (this.onion && !this.playing) {
      const ghost = (index: number, color: string, depth: number) => {
        const frame = this.frames[index]
        if (!frame) return
        stage.globalAlpha = 0.42 * (1 - (depth - 1) / (this.onionCount + 1))
        stage.fillStyle = color
        for (let i = 0; i < SIZE; i += 1) if (frame[i]) stage.fillRect(i % W, (i / W) | 0, 1, 1)
      }
      for (let depth = this.onionCount; depth >= 1; depth -= 1) {
        ghost(this.current - depth, cssVar("--onion-prev"), depth)
        if (this.onionNext) ghost(this.current + depth, cssVar("--onion-next"), depth)
      }
      stage.globalAlpha = 1
    }

    const frame = this.frames[this.current]
    stage.fillStyle = on
    if (frame) for (let i = 0; i < SIZE; i += 1) if (frame[i]) stage.fillRect(i % W, (i / W) | 0, 1, 1)
  }

  /* ───────────── Timeline geometry ───────────── */

  watchTimeline: Attachment<HTMLElement> = (node) => {
    const measure = () => {
      const count = this.frames.length
      const cell = parseFloat(cssVar("--cell")) || 16
      this.cell = cell
      this.slots = Math.max(count + 30, Math.ceil(node.clientWidth / cell) + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }

  frameAt = (event: { clientX: number }, track: HTMLElement) => {
    const rect = track.getBoundingClientRect()
    return Math.floor((event.clientX - rect.left) / this.cell)
  }

  gapAt = (event: { clientX: number }, track: HTMLElement) => {
    const rect = track.getBoundingClientRect()
    return Math.min(this.frames.length, Math.max(0, Math.round((event.clientX - rect.left) / this.cell)))
  }

  onRuler = (event: { clientY: number }, track: HTMLElement) => event.clientY - track.getBoundingClientRect().top < RULER_H

  showAddHover = (index: number) => {
    this.addHover = index >= this.frames.length ? index : -1
  }

  /* ───────────── Context menu ───────────── */

  openContext = (x: number, y: number, index: number, focusFirst = false) => {
    this.#contextReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null
    this.context = { x, y, index }
    flushSync()
    const menu = this.contextEl
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))
    const top = y + rect.height > window.innerHeight - 4 ? Math.max(4, y - rect.height) : y
    this.context = { x: left, y: top, index }
    if (focusFirst) menu.querySelector<HTMLElement>("button[role^='menuitem']")?.focus()
  }

  closeContext = (restoreFocus = false) => {
    if (!this.context) return
    this.context = null
    if (restoreFocus && this.#contextReturn && document.contains(this.#contextReturn)) this.#contextReturn.focus()
    this.#contextReturn = null
  }

  /* ───────────── Playback ───────────── */

  #tick = (now: number) => {
    if (!this.playing) return
    if (this.#playStart === null) this.#playStart = now
    const count = this.frames.length
    const elapsed = Math.max(0, now - this.#playStart)
    let index = this.#playFrom + Math.floor((elapsed / 1000) * this.fps)
    let finished = false
    if (index >= count) {
      if (this.loop) index %= count
      else {
        index = count - 1
        finished = true
      }
    }
    if (index !== this.current) this.#collapse(index)
    if (finished) this.stop()
    else this.#playRaf = requestAnimationFrame(this.#tick)
  }

  play = () => {
    if (this.playing) return
    if (this.frames.length < 2) {
      this.status = "Only one frame so far. Add frames to play an animation."
      return
    }
    if (!this.loop && this.current === this.frames.length - 1) this.current = 0
    this.playing = true
    this.#playFrom = this.current
    this.#playStart = null
    this.paintSerial += 1
    this.status = `Playing at ${this.fps} fps${this.loop ? ", looping" : ""}.`
    this.#playRaf = requestAnimationFrame(this.#tick)
  }

  stop = () => {
    if (!this.playing) return
    this.playing = false
    cancelAnimationFrame(this.#playRaf)
    this.paintSerial += 1
    this.status = ""
  }

  togglePlay = () => (this.playing ? this.stop() : this.play())

  /* ───────────── Commands from menus, toolbar, and keys ───────────── */

  perform = (action: string, slot = -1) => {
    switch (action) {
      case "new":
        return this.newAnimation()
      case "export":
        return this.exportMidi()
      case "undo":
        return this.undo()
      case "redo":
        return this.redo()
      case "duplicate":
        return this.duplicateSelection()
      case "blank":
        return this.insertBlank()
      case "delete":
        return this.deleteSelection()
      case "clear":
        return this.#editFrames(() => 0, "Cleared")
      case "invert":
        return this.#editFrames((value) => 1 - value, "Inverted")
      case "cut":
        return this.cutFrames()
      case "copy":
        return this.copyFrames()
      case "paste-after":
        return this.pasteAt(this.selEnd + 1)
      case "paste-before":
        return this.pasteAt(this.selStart)
      case "paste-replace":
        return this.pasteAt(this.selStart, "replace")
      case "paste-here":
        return this.pasteAt(slot)
      case "add-here":
        return this.addFramesTo(slot, false)
      case "move-left":
        return this.moveBy(-1)
      case "move-right":
        return this.moveBy(1)
      case "select-all":
        return this.selectAll()
      case "play":
        return this.togglePlay()
      case "first":
        return this.jump(0)
      case "last":
        return this.jump(this.frames.length - 1)
      case "prev":
        this.stop()
        return this.goTo(this.current - 1)
      case "next":
        this.stop()
        return this.goTo(this.current + 1)
      case "toggle-loop":
        this.loop = !this.loop
        this.save()
        return
      case "toggle-onion":
        return this.setOnion({ onion: !this.onion })
      case "toggle-onion-next":
        return this.setOnion({ onionNext: !this.onionNext })
      case "toggle-grid":
        this.grid = !this.grid
        this.save()
        return
      case "toggle-blocks":
        this.blocks = !this.blocks
        this.save()
        return
      case "keys":
        return this.showKeys()
      case "about":
        return this.showAbout()
      default:
        return undefined
    }
  }

  onKeydown = (event: KeyboardEvent) => {
    if (this.keysOpen || this.aboutOpen) return
    if (event.altKey && !event.ctrlKey && !event.metaKey) return
    if (event.key === "Escape") {
      if (this.context) {
        event.preventDefault()
        this.closeContext(true)
      }
      return
    }
    if (this.context) return

    const target = event.target
    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        Boolean(target.closest("textarea, select")) ||
        (target instanceof HTMLInputElement && target.type !== "range" && target.type !== "checkbox"))

    if (event.ctrlKey || event.metaKey) {
      if (typing) return
      const key = event.key.toLowerCase()
      const handled: Record<string, () => void> = {
        z: () => (event.shiftKey ? this.redo() : this.undo()),
        y: () => this.redo(),
        c: () => this.copyFrames(),
        x: () => this.cutFrames(),
        v: () => (event.shiftKey ? this.pasteAt(this.selStart) : this.pasteAt(this.selEnd + 1)),
        a: () => this.selectAll(),
      }
      const command = handled[key]
      if (command) {
        event.preventDefault()
        command()
      }
      return
    }

    if (typing) return
    const onButton = target instanceof HTMLElement && Boolean(target.closest("button, summary, [role='button']"))

    switch (event.key) {
      case " ":
        if (onButton || target instanceof HTMLInputElement) return
        event.preventDefault()
        this.togglePlay()
        return
      case ",":
      case ".":
        event.preventDefault()
        this.perform(event.key === "," ? "prev" : "next")
        return
      case "ArrowLeft":
      case "ArrowRight":
        if (target instanceof HTMLInputElement && target.type === "range") return
        event.preventDefault()
        if (event.shiftKey) {
          this.stop()
          this.extendTo(Math.min(this.frames.length - 1, Math.max(0, this.current + (event.key === "ArrowLeft" ? -1 : 1))))
          this.refreshSelection()
        } else this.perform(event.key === "ArrowLeft" ? "prev" : "next")
        return
      case "<":
      case ">":
        event.preventDefault()
        this.moveBy(event.key === "<" ? -1 : 1)
        return
      case "Home":
        event.preventDefault()
        this.perform("first")
        return
      case "End":
        event.preventDefault()
        this.perform("last")
        return
      case "Delete":
      case "Backspace":
        event.preventDefault()
        this.deleteSelection()
        return
    }

    switch (event.key.toLowerCase()) {
      case "p":
        return this.setTool("pencil")
      case "e":
        return this.setTool("eraser")
      case "a":
        return this.setTool("auto")
      case "d":
        return this.duplicateSelection()
      case "n":
        return this.insertBlank()
      case "o":
        return this.perform("toggle-onion")
      case "g":
        return this.perform("toggle-grid")
      case "[":
        return this.setOnion({ onionCount: Math.max(1, this.onionCount - 1) })
      case "]":
        return this.setOnion({ onionCount: Math.min(8, this.onionCount + 1) })
      default:
        return undefined
    }
  }
}
