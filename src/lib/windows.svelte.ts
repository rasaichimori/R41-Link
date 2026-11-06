import { flushSync } from "svelte"

const MIN_W = 180
const MIN_H = 120

/** Below this width, windows stack in normal flow instead of floating. */
const FLOATING_QUERY = "(min-width: 641px)"

export const RESIZE_EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const
export type ResizeEdge = (typeof RESIZE_EDGES)[number]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export class DesktopWindow {
  /** --win-x / --win-y in px, from the desktop's padding edge */
  x = $state(0)
  y = $state(0)
  /** --win-w: a CSS length until a resize writes pixels */
  width = $state("")
  /** --win-h: the height to keep, remembered across maximize */
  keptHeight = $state<number | null>(null)
  height = $state<number | null>(null)
  maxWidth = $state<number | null>(null)
  maxHeight = $state<number | null>(null)
  maximized = $state(false)
  minimized = $state(false)
  el: HTMLElement | null = null

  readonly id: string
  readonly label: string

  constructor(id: string, label: string, x: number, y: number, width: string) {
    this.id = id
    this.label = label
    this.x = x
    this.y = y
    this.width = width
  }

  /** The width in pixels once a resize has set it, else null. */
  get pixelWidth() {
    if (!this.width.endsWith("px")) return null
    const value = parseFloat(this.width)
    return Number.isFinite(value) ? value : null
  }

  clearSizeCaps = () => {
    this.height = null
    this.maxWidth = null
    this.maxHeight = null
  }
}

/**
 * Floating desktop windows. Stacking follows `order`: the focused window is
 * rendered last, which paints it on top of the others without a z-index.
 */
export class WindowManager {
  order = $state<string[]>([])
  activeId = $state<string | null>(null)
  desktop: HTMLElement | null = null
  taskbar: HTMLElement | null = null
  readonly list: DesktopWindow[]

  #floating = window.matchMedia(FLOATING_QUERY)

  constructor(windows: DesktopWindow[]) {
    this.list = windows
    this.order = windows.map((win) => win.id)
    this.activeId = this.order.at(-1) ?? null
  }

  get = (id: string) => {
    const win = this.list.find((candidate) => candidate.id === id)
    if (!win) throw new Error(`Unknown window ${id}`)
    return win
  }

  get floating() {
    return this.#floating.matches
  }

  /** Refit every window when the screen or floating mode changes. Returns a cleanup. */
  listen = () => {
    this.#floating.addEventListener("change", this.fitAll)
    return () => this.#floating.removeEventListener("change", this.fitAll)
  }

  canInteract = (win: DesktopWindow, event: PointerEvent) =>
    event.button === 0 && this.floating && !win.maximized

  /** Raise `win`. The DOM move is flushed now so pointer capture taken afterwards survives it. */
  activate = (win: DesktopWindow | undefined) => {
    if (!win || win.minimized) return
    const changed = this.order.at(-1) !== win.id || this.activeId !== win.id
    if (!changed) return
    if (this.order.at(-1) !== win.id) this.order = [...this.order.filter((id) => id !== win.id), win.id]
    this.activeId = win.id
    flushSync()
  }

  minimize = (win: DesktopWindow) => {
    win.minimized = true
    if (this.activeId === win.id) this.activeId = null
    const next = this.order
      .map(this.get)
      .filter((other) => !other.minimized)
      .at(-1)
    this.activate(next)
  }

  restore = (win: DesktopWindow) => {
    win.minimized = false
    this.activate(win)
    flushSync()
    this.fit(win)
  }

  toggleMaximize = (win: DesktopWindow) => {
    win.minimized = false
    win.maximized = !win.maximized
    if (win.maximized) {
      win.clearSizeCaps()
    } else {
      flushSync()
      this.fit(win)
    }
    this.activate(win)
  }

  /** Taskbar button: minimize the active window, otherwise bring it back. */
  focusFromTaskbar = (win: DesktopWindow) => {
    if (!win.minimized && this.activeId === win.id) {
      this.minimize(win)
      return
    }
    this.restore(win)
  }

  /* The visible desktop, in the same coordinates as --win-x / --win-y. Height stops at the taskbar. */
  #bounds = () => {
    if (!this.desktop || !this.taskbar) return { width: 0, height: 0 }
    const desk = this.desktop.getBoundingClientRect()
    const bar = this.taskbar.getBoundingClientRect()
    return { width: this.desktop.clientWidth, height: Math.max(0, bar.top - desk.top) }
  }

  /* How tall the window wants to be when nothing has resized it yet. */
  #contentHeight = (el: HTMLElement) => {
    const body = el.querySelector<HTMLElement>(".window-body")
    if (!body) return Math.max(MIN_H, el.offsetHeight)
    return Math.max(MIN_H, Math.ceil(el.offsetHeight - body.offsetHeight + body.scrollHeight))
  }

  #place = (win: DesktopWindow, x: number, y: number, bounds: { width: number; height: number }) => {
    win.x = x
    win.y = y
    win.maxWidth = Math.max(0, bounds.width - x)
    win.maxHeight = Math.max(0, bounds.height - y)
  }

  /* Move without changing the size the user picked. The window stops at the screen edges. */
  move = (win: DesktopWindow, x: number, y: number) => {
    if (!win.el) return
    const bounds = this.#bounds()
    const width = win.el.offsetWidth
    const height = win.el.offsetHeight
    this.#place(
      win,
      clamp(Math.round(x), 0, Math.max(0, bounds.width - width)),
      clamp(Math.round(y), 0, Math.max(0, bounds.height - height)),
      bounds,
    )
  }

  resize = (win: DesktopWindow, x: number, y: number, width: number, height: number) => {
    const bounds = this.#bounds()
    width = clamp(Math.round(width), MIN_W, bounds.width)
    height = clamp(Math.round(height), MIN_H, bounds.height)
    this.#place(
      win,
      clamp(Math.round(x), 0, Math.max(0, bounds.width - width)),
      clamp(Math.round(y), 0, Math.max(0, bounds.height - height)),
      bounds,
    )
    win.width = `${width}px`
    win.keptHeight = height
    win.height = height
  }

  fit = (win: DesktopWindow) => {
    const el = win.el
    if (!el || !this.floating || win.maximized || win.minimized) {
      win.clearSizeCaps()
      return
    }
    const bounds = this.#bounds()
    const desiredW = win.pixelWidth ?? el.offsetWidth
    const desiredH = win.keptHeight ?? this.#contentHeight(el)
    win.keptHeight = desiredH
    const width = Math.min(Math.max(desiredW, MIN_W), bounds.width)
    const height = Math.min(desiredH, bounds.height)
    const x = clamp(win.x, 0, Math.max(0, bounds.width - width))
    const y = clamp(win.y, 0, Math.max(0, bounds.height - height))
    this.#place(win, x, y, bounds)
    win.height = Math.min(desiredH, Math.max(0, bounds.height - y))
  }

  fitAll = () => {
    for (const win of this.list) this.fit(win)
  }

  /* Drag a window by its title bar. */
  startDrag = (win: DesktopWindow, titleBar: HTMLElement, event: PointerEvent) => {
    const originX = win.x
    const originY = win.y
    const startX = event.clientX
    const startY = event.clientY
    try {
      titleBar.setPointerCapture(event.pointerId)
    } catch {
      /* already released */
    }

    const move = (next: PointerEvent) => {
      this.move(win, originX + next.clientX - startX, originY + next.clientY - startY)
    }
    const stop = () => titleBar.removeEventListener("pointermove", move)
    titleBar.addEventListener("pointermove", move)
    titleBar.addEventListener("pointerup", stop, { once: true })
    titleBar.addEventListener("pointercancel", stop, { once: true })
  }

  /* Resize from an edge or corner. The opposite edge stays put, and the dragged edge stops at the screen. */
  startResize = (win: DesktopWindow, edge: ResizeEdge, event: PointerEvent, handle: HTMLElement) => {
    if (!win.el) return
    const bounds = this.#bounds()
    const origin = { x: win.x, y: win.y, w: win.el.offsetWidth, h: win.el.offsetHeight }
    const startX = event.clientX
    const startY = event.clientY
    const west = edge.includes("w")
    const east = edge.includes("e")
    const north = edge.includes("n")
    const south = edge.includes("s")
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      /* already released */
    }

    const move = (next: PointerEvent) => {
      const dx = next.clientX - startX
      const dy = next.clientY - startY
      let { x, y, w, h } = origin
      if (east) w = clamp(Math.round(origin.w + dx), MIN_W, bounds.width - origin.x)
      if (west) {
        w = clamp(Math.round(origin.w - dx), MIN_W, origin.x + origin.w)
        x = origin.x + origin.w - w
      }
      if (south) h = clamp(Math.round(origin.h + dy), MIN_H, bounds.height - origin.y)
      if (north) {
        h = clamp(Math.round(origin.h - dy), MIN_H, origin.y + origin.h)
        y = origin.y + origin.h - h
      }
      this.resize(win, x, y, w, h)
    }
    const stop = () => handle.removeEventListener("pointermove", move)
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", stop, { once: true })
    handle.addEventListener("pointercancel", stop, { once: true })
  }

  /** Pointer-down on a resize handle or the status bar grip. */
  beginResize = (win: DesktopWindow, edge: ResizeEdge, event: PointerEvent) => {
    if (!this.canInteract(win, event)) return
    event.preventDefault()
    this.activate(win)
    this.startResize(win, edge, event, event.currentTarget as HTMLElement)
  }
}
