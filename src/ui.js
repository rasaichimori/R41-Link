/**
 * R41 Link UI layer: menus, console, How it works, zoom, keyboard shortcuts
 * and drop-anywhere. It only talks to main.js through the DOM (clicking its
 * controls and watching its outputs).
 */

const $ = (id) => document.getElementById(id)
const root = document.documentElement
const body = document.body

const dropzone = $("dropzone")
const fileInput = $("file-input")
const fileName = $("file-name")
const playBtn = $("preview-playback")
const rewindBtn = $("preview-reset-start")
const exportBtn = $("export-video-midi")
const exportStatus = $("export-status")
const timeline = $("video-timeline")
const canvas = $("preview")
const overlay = $("lcd-overlay")
const scaleInput = $("scale")
const invertInput = $("invert")
const consoleEl = $("console")
const consoleLines = $("console-lines")
const howDialog = $("how-dialog")
const aboutDialog = $("about-dialog")

const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim()

/* ───────────── Pixel glyphs (3×5) for text drawn in display pixels ───────────── */

const GLYPHS = {
  0: ["111", "101", "101", "101", "111"],
  1: ["1", "1", "1", "1", "1"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
  D: ["110", "101", "101", "101", "110"],
  R: ["110", "101", "110", "101", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
}

/** Plot `text` with the pixel glyphs (1 dot between letters); `dot(x, y)` is called for each lit cell. */
const plotText = (text, x0, y0, dot) => {
  let x = x0
  for (const ch of text) {
    const glyph = GLYPHS[ch]
    if (!glyph) continue
    glyph.forEach((row, y) => {
      for (let i = 0; i < row.length; i += 1) if (row[i] === "1") dot(x + i, y0 + y)
    })
    x += glyph[0].length + 1
  }
}
const textWidth = (text) =>
  [...text].reduce((w, ch) => w + (GLYPHS[ch]?.[0].length ?? 0) + 1, 0) - 1

/* ───────────── Files ───────────── */

const openPicker = () => {
  if (!fileInput.disabled) fileInput.click()
}

dropzone.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return
  event.preventDefault()
  openPicker()
})

/* Drop a file anywhere on the page */
const ARROW = ["..XXX..", "..XXX..", "..XXX..", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."]
const drawDropOverlay = () => {
  const ctx = overlay.getContext("2d")
  ctx.fillStyle = cssVar("--pixel-off")
  ctx.fillRect(0, 0, 26, 27)
  ctx.fillStyle = cssVar("--pixel-on")
  const top = 6
  ARROW.forEach((row, y) => [...row].forEach((c, x) => c === "X" && ctx.fillRect(10 + x - 1, top + y, 1, 1)))
  plotText("DROP", Math.floor((26 - textWidth("DROP")) / 2), top + ARROW.length + 3, (x, y) => ctx.fillRect(x, y, 1, 1))
}
drawDropOverlay()

let dragDepth = 0
const hasFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes("Files")
const endDrag = () => {
  dragDepth = 0
  body.classList.remove("is-file-dragging")
}
document.addEventListener("dragenter", (event) => {
  if (!hasFiles(event)) return
  dragDepth += 1
  body.classList.add("is-file-dragging")
})
document.addEventListener("dragleave", (event) => {
  if (!hasFiles(event)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) endDrag()
})
document.addEventListener("dragover", (event) => {
  if (!hasFiles(event)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = fileInput.disabled ? "none" : "copy"
})
document.addEventListener("drop", (event) => {
  endDrag()
  if (!hasFiles(event)) return
  event.preventDefault()
  if (dropzone.contains(event.target)) return // main.js handles drops on the drop zone
  const files = event.dataTransfer.files
  if (!files?.length || fileInput.disabled) return
  fileInput.files = files
  fileInput.dispatchEvent(new Event("change"))
})

/* ───────────── Console ───────────── */

const MAX_LINES = 300
let lastPattern = null

const addLine = (text, { command = false, merge = false } = {}) => {
  const pattern = text.replace(/\d+/g, "#")
  const last = consoleLines.lastElementChild
  if (merge && last && pattern === lastPattern) {
    last.textContent = text
  } else {
    const line = document.createElement("p")
    line.textContent = text
    if (command) line.className = "is-cmd"
    consoleLines.append(line)
    while (consoleLines.childElementCount > MAX_LINES) consoleLines.firstElementChild.remove()
  }
  lastPattern = command ? null : pattern
  consoleEl.scrollTop = consoleEl.scrollHeight
}

const command = (text) => addLine(`C:\\R41LINK>${text}`, { command: true })

// Other scripts can write to the console: window.dispatchEvent(new CustomEvent("r41:log", { detail: "text" }))
window.addEventListener("r41:log", (event) => addLine(String(event.detail)))

/* ───────────── Media state, title, console mirroring ───────────── */

const initialName = fileName.textContent
const docName = $("window-doc")

new MutationObserver(() => {
  const loaded = fileName.textContent !== initialName
  body.dataset.media = loaded ? "loaded" : "none"
  docName.textContent = loaded ? fileName.textContent : "Untitled"
  document.title = loaded ? `${fileName.textContent} - MIDI Converter` : "MIDI Converter"
  if (loaded) command(`load ${fileName.textContent}`)
}).observe(fileName, { childList: true, characterData: true, subtree: true })

// Log every status message, including ones main.js replaces within the same tick
new MutationObserver((records) => {
  for (const record of records) {
    const texts =
      record.type === "characterData"
        ? [record.target.textContent]
        : [...record.addedNodes].map((node) => node.textContent)
    for (const text of texts) if (text?.trim()) addLine(text.trim(), { merge: true })
  }
}).observe(exportStatus, { childList: true, characterData: true, subtree: true })

// main.js toggles state synchronously in its own click handler, which runs first
playBtn.addEventListener("click", () => command(playBtn.classList.contains("is-playing") ? "play" : "stop"))
rewindBtn.addEventListener("click", () => command("rewind"))
exportBtn.addEventListener("click", () => command("export --midi"))
invertInput.addEventListener("change", () => command(`invert ${invertInput.checked ? "on" : "off"}`))

/* ───────────── Windows ───────────── */

const desktop = document.querySelector(".desktop")
const taskbar = document.querySelector(".taskbar")
const FLOATING = window.matchMedia("(min-width: 641px)") // below this, windows stack in normal flow
const SIDE_BY_SIDE = window.matchMedia("(min-width: 900px)") // workspace grid: display beside the side panels

const desktopWindows = () => [...desktop.querySelectorAll(":scope > .window")]
const topWindow = () => desktopWindows().at(-1)
const taskButtonFor = (win) => document.querySelector(`.task-button[data-window="${win.id}"]`)
const isMinimized = (win) => win.classList.contains("is-minimized")
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const setMaximized = (win, on) => {
  win.classList.toggle("is-maximized", on)
  const btn = win.querySelector('[data-action="maximize"]')
  if (btn) {
    btn.setAttribute("aria-pressed", String(on))
    btn.setAttribute("aria-label", on ? "Restore" : "Maximize")
  }
  if (on) {
    win.style.removeProperty("height")
    win.style.removeProperty("max-width")
    win.style.removeProperty("max-height")
  } else {
    fitWindow(win)
  }
}

/* The visible desktop, in the same coordinates as --win-x / --win-y (the desktop's
   padding edge). Height stops at the taskbar so a window cannot slide under it. */
const boundsOf = () => {
  const desk = desktop.getBoundingClientRect()
  const bar = taskbar.getBoundingClientRect()
  return {
    width: desktop.clientWidth,
    height: Math.max(0, bar.top - desk.top),
  }
}

const parsePx = (win, name) => {
  const value = parseFloat(win.style.getPropertyValue(name))
  return Number.isFinite(value) ? value : 0
}

const MIN_W = 180
const MIN_H = 120

/* A length the user or a resize wrote, rather than the starting min()/calc() width. */
const pxVar = (win, name) => {
  const raw = win.style.getPropertyValue(name).trim()
  if (!raw.endsWith("px")) return null
  const value = parseFloat(raw)
  return Number.isFinite(value) ? value : null
}

/* How tall the window wants to be when nothing has resized it yet. */
const contentHeight = (win) => {
  const body = win.querySelector(".window-body")
  if (!body) return Math.max(MIN_H, win.offsetHeight)
  return Math.max(MIN_H, Math.ceil(win.offsetHeight - body.offsetHeight + body.scrollHeight))
}

/* Move without changing the size the user picked. The window stops at the screen edges. */
const moveWindow = (win, x, y) => {
  const bounds = boundsOf()
  const width = win.offsetWidth
  const height = win.offsetHeight
  x = clamp(Math.round(x), 0, Math.max(0, bounds.width - width))
  y = clamp(Math.round(y), 0, Math.max(0, bounds.height - height))
  win.style.setProperty("--win-x", `${x}px`)
  win.style.setProperty("--win-y", `${y}px`)
  win.style.maxWidth = `${Math.max(0, bounds.width - x)}px`
  win.style.maxHeight = `${Math.max(0, bounds.height - y)}px`
}

/* Width and height are the size to keep. --win-h remembers it across maximize;
   --win-w is only written in pixels once a resize sets it, so the starting
   min()/calc() width can still follow the screen until then. */
const resizeWindow = (win, x, y, width, height) => {
  const bounds = boundsOf()
  width = clamp(Math.round(width), MIN_W, bounds.width)
  height = clamp(Math.round(height), MIN_H, bounds.height)
  x = clamp(Math.round(x), 0, Math.max(0, bounds.width - width))
  y = clamp(Math.round(y), 0, Math.max(0, bounds.height - height))
  win.style.setProperty("--win-x", `${x}px`)
  win.style.setProperty("--win-y", `${y}px`)
  win.style.setProperty("--win-w", `${width}px`)
  win.style.setProperty("--win-h", `${height}px`)
  win.style.maxWidth = `${Math.max(0, bounds.width - x)}px`
  win.style.maxHeight = `${Math.max(0, bounds.height - y)}px`
  win.style.height = `${height}px`
}

const fitWindow = (win) => {
  if (!FLOATING.matches || win.classList.contains("is-maximized") || isMinimized(win)) {
    win.style.removeProperty("height")
    win.style.removeProperty("max-width")
    win.style.removeProperty("max-height")
    return
  }
  const bounds = boundsOf()
  let x = parsePx(win, "--win-x")
  let y = parsePx(win, "--win-y")
  const desiredW = pxVar(win, "--win-w") ?? win.offsetWidth
  let desiredH = pxVar(win, "--win-h")
  if (desiredH == null) {
    desiredH = contentHeight(win)
    win.style.setProperty("--win-h", `${desiredH}px`)
  }
  const width = Math.min(Math.max(desiredW, MIN_W), bounds.width)
  const height = Math.min(desiredH, bounds.height)
  x = clamp(x, 0, Math.max(0, bounds.width - width))
  y = clamp(y, 0, Math.max(0, bounds.height - height))
  win.style.setProperty("--win-x", `${x}px`)
  win.style.setProperty("--win-y", `${y}px`)
  win.style.maxWidth = `${Math.max(0, bounds.width - x)}px`
  win.style.maxHeight = `${Math.max(0, bounds.height - y)}px`
  win.style.height = `${Math.min(desiredH, Math.max(0, bounds.height - y))}px`
}

/* Focusing a window moves it to the end of .desktop, which paints it on top of the others */
const activateWindow = (win) => {
  if (!win || isMinimized(win)) return
  if (topWindow() !== win) desktop.append(win)
  for (const other of desktopWindows()) {
    const active = other === win
    other.classList.toggle("is-active", active)
    taskButtonFor(other)?.setAttribute("aria-pressed", String(active))
  }
}

const minimizeWindow = (win) => {
  win.classList.add("is-minimized")
  win.classList.remove("is-active")
  taskButtonFor(win)?.setAttribute("aria-pressed", "false")
  activateWindow(desktopWindows().filter((other) => !isMinimized(other)).at(-1))
}

const restoreWindow = (win) => {
  win.classList.remove("is-minimized")
  activateWindow(win)
  fitWindow(win)
}

/* Drag a window by its title bar. The window stops at the screen edges. */
const startDrag = (win, titleBar, event) => {
  const originX = parsePx(win, "--win-x")
  const originY = parsePx(win, "--win-y")
  const startX = event.clientX
  const startY = event.clientY
  try { titleBar.setPointerCapture(event.pointerId) } catch { /* already released */ }

  const move = (next) => {
    moveWindow(win, originX + next.clientX - startX, originY + next.clientY - startY)
  }
  const stop = () => titleBar.removeEventListener("pointermove", move)
  titleBar.addEventListener("pointermove", move)
  titleBar.addEventListener("pointerup", stop, { once: true })
  titleBar.addEventListener("pointercancel", stop, { once: true })
}

/* Resize from an edge or corner. The opposite edge stays put, and the dragged
   edge stops at the screen. */
const startResize = (win, edge, event, handle) => {
  const bounds = boundsOf()
  const origin = {
    x: parsePx(win, "--win-x"),
    y: parsePx(win, "--win-y"),
    w: win.offsetWidth,
    h: win.offsetHeight,
  }
  const startX = event.clientX
  const startY = event.clientY
  const west = edge.includes("w")
  const east = edge.includes("e")
  const north = edge.includes("n")
  const south = edge.includes("s")
  try { handle.setPointerCapture(event.pointerId) } catch { /* already released */ }

  const move = (next) => {
    const dx = next.clientX - startX
    const dy = next.clientY - startY
    let x = origin.x
    let y = origin.y
    let w = origin.w
    let h = origin.h
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
    resizeWindow(win, x, y, w, h)
  }
  const stop = () => handle.removeEventListener("pointermove", move)
  handle.addEventListener("pointermove", move)
  handle.addEventListener("pointerup", stop, { once: true })
  handle.addEventListener("pointercancel", stop, { once: true })
}

/* Clock */
const clock = $("clock")
const tick = () => {
  const now = new Date()
  clock.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  clock.dateTime = now.toISOString()
}
tick()
setInterval(tick, 15_000)

/* ───────────── Color schemes ───────────── */

const SCHEME_KEY = "r41-link-scheme"
let scheme = "auto"

const setScheme = (next, persist = true) => {
  scheme = next === "light" || next === "dark" ? next : "auto"
  if (scheme === "auto") delete root.dataset.theme
  else root.dataset.theme = scheme
  if (persist) {
    try {
      localStorage.setItem(SCHEME_KEY, scheme)
    } catch {
      /* storage unavailable */
    }
  }
}

try {
  const saved = localStorage.getItem(SCHEME_KEY)
  if (saved) setScheme(saved, false)
} catch {
  /* storage unavailable */
}

/* ───────────── Actions ───────────── */

const usable = (el) => !el.hidden && !el.disabled && !el.closest("[hidden]")

const actions = {
  open: openPicker,
  export: () => usable(exportBtn) && exportBtn.click(),
  play: () => usable(playBtn) && playBtn.click(),
  rewind: () => usable(rewindBtn) && rewindBtn.click(),
  "toggle-invert": () => !invertInput.disabled && invertInput.click(),
  how: () => {
    howDialog.showModal()
    startHowLoop()
  },
  about: () => aboutDialog.showModal(),
  scheme: (el) => setScheme(el.dataset.scheme),
  minimize: (el) => {
    const win = el.closest(".window")
    if (win) minimizeWindow(win)
  },
  maximize: (el) => {
    const win = el.closest(".window")
    if (!win) return
    if (isMinimized(win)) win.classList.remove("is-minimized")
    setMaximized(win, !win.classList.contains("is-maximized"))
    activateWindow(win)
  },
  "focus-window": (el) => {
    const win = document.getElementById(el.dataset.window)
    if (!win) return
    const canMinimize = Boolean(win.querySelector('[data-action="minimize"]'))
    if (!isMinimized(win) && win.classList.contains("is-active") && canMinimize) {
      minimizeWindow(win)
      return
    }
    restoreWindow(win)
  },
}

const RESIZE_EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"]

for (const win of desktopWindows()) {
  for (const edge of RESIZE_EDGES) {
    const handle = document.createElement("div")
    handle.className = `resize-handle resize-${edge}`
    handle.dataset.resize = edge
    if (edge === "se") handle.setAttribute("aria-label", "Resize")
    else handle.setAttribute("aria-hidden", "true")
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !FLOATING.matches || win.classList.contains("is-maximized")) return
      event.preventDefault()
      activateWindow(win)
      startResize(win, edge, event, handle)
    })
    win.append(handle)
  }
  const grip = win.querySelector(".resize-grip")
  if (grip) {
    grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !FLOATING.matches || win.classList.contains("is-maximized")) return
      event.preventDefault()
      activateWindow(win)
      startResize(win, "se", event, grip)
    })
  }
  const titleBar = win.querySelector(".title-bar")
  titleBar.addEventListener("pointerdown", (event) => {
    // Activate first: moving the window in the DOM must happen before the pointer is captured
    activateWindow(win)
    if (event.button !== 0 || !FLOATING.matches || win.classList.contains("is-maximized")) return
    if (event.target.closest(".title-controls, .resize-handle")) return
    startDrag(win, titleBar, event)
  })
  titleBar.addEventListener("dblclick", (event) => {
    if (event.target.closest(".title-controls")) return
    const btn = win.querySelector('[data-action="maximize"]')
    if (btn) actions.maximize(btn)
  })
  win.addEventListener("pointerdown", () => activateWindow(win))
}

/* Real scrollbars, because the system ones are overlays that disappear. Each bar
   drives the client area's own scroll. */
const SCROLL = {
  y: {
    size: (el) => el.scrollHeight,
    client: (el) => el.clientHeight,
    pos: (el) => el.scrollTop,
    set: (el, value) => { el.scrollTop = value },
    edge: "top",
    extent: "height",
    dec: "Scroll up",
    inc: "Scroll down",
  },
  x: {
    size: (el) => el.scrollWidth,
    client: (el) => el.clientWidth,
    pos: (el) => el.scrollLeft,
    set: (el, value) => { el.scrollLeft = value },
    edge: "left",
    extent: "width",
    dec: "Scroll left",
    inc: "Scroll right",
  },
}

const makeScrollBar = (axis) => {
  const bar = document.createElement("div")
  bar.className = axis === "y" ? "vscroll" : "hscroll"
  bar.setAttribute("role", "scrollbar")
  bar.setAttribute("aria-orientation", axis === "y" ? "vertical" : "horizontal")
  bar.setAttribute("aria-valuemin", "0")
  const button = (dir, label) => {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "scroll-btn"
    el.dataset.dir = String(dir)
    el.setAttribute("aria-label", label)
    return el
  }
  const track = document.createElement("div")
  track.className = "scroll-track"
  const thumb = document.createElement("div")
  thumb.className = "scroll-thumb"
  track.append(thumb)
  const dec = button(-1, SCROLL[axis].dec)
  const inc = button(1, SCROLL[axis].inc)
  bar.append(dec, track, inc)
  if (axis === "x") {
    const corner = document.createElement("div")
    corner.className = "scroll-corner"
    corner.setAttribute("aria-hidden", "true")
    bar.append(corner)
  }
  return { bar, track, thumb, dec, inc }
}

const bindScrollBar = (scroller, axis, parts) => {
  const spec = SCROLL[axis]
  const { bar, track, thumb, dec, inc } = parts

  const metrics = () => {
    const overflow = Math.max(0, spec.size(scroller) - spec.client(scroller))
    const trackSize = axis === "y" ? track.clientHeight : track.clientWidth
    const thumbSize = overflow > 0 ? Math.max(16, Math.round((trackSize * spec.client(scroller)) / spec.size(scroller))) : trackSize
    const travel = Math.max(0, trackSize - thumbSize)
    const pos = overflow > 0 && travel > 0 ? (spec.pos(scroller) / overflow) * travel : 0
    return { overflow, thumbSize, travel, pos }
  }

  const paint = () => {
    const { thumbSize, pos } = metrics()
    bar.setAttribute("aria-valuemax", String(Math.max(0, spec.size(scroller) - spec.client(scroller))))
    bar.setAttribute("aria-valuenow", String(Math.round(spec.pos(scroller))))
    thumb.style[spec.extent] = `${thumbSize}px`
    thumb.style[spec.edge] = `${pos}px`
  }

  const hold = (dir, event) => {
    event.preventDefault()
    const buttonEl = event.currentTarget
    const step = () => spec.set(scroller, spec.pos(scroller) + dir * 48)
    step()
    try { buttonEl.setPointerCapture(event.pointerId) } catch { /* already released */ }
    let pulse
    const wait = setTimeout(() => { pulse = setInterval(step, 50) }, 280)
    const stop = () => { clearTimeout(wait); clearInterval(pulse) }
    buttonEl.addEventListener("pointerup", stop, { once: true })
    buttonEl.addEventListener("pointercancel", stop, { once: true })
  }
  dec.addEventListener("pointerdown", (event) => hold(-1, event))
  inc.addEventListener("pointerdown", (event) => hold(1, event))
  // Keyboard activation and .click() report detail 0. A real mouse click follows pointerdown, so it is ignored here.
  dec.addEventListener("click", (event) => {
    if (event.detail !== 0) return
    spec.set(scroller, spec.pos(scroller) - 48)
  })
  inc.addEventListener("click", (event) => {
    if (event.detail !== 0) return
    spec.set(scroller, spec.pos(scroller) + 48)
  })

  track.addEventListener("pointerdown", (event) => {
    if (event.target !== track) return
    const rect = track.getBoundingClientRect()
    const along = axis === "y" ? event.clientY - rect.top : event.clientX - rect.left
    const thumbStart = axis === "y" ? thumb.offsetTop : thumb.offsetLeft
    const dir = along < thumbStart ? -1 : 1
    spec.set(scroller, spec.pos(scroller) + dir * spec.client(scroller) * 0.9)
  })

  thumb.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const start = spec.pos(scroller)
    const origin = axis === "y" ? event.clientY : event.clientX
    try { thumb.setPointerCapture(event.pointerId) } catch { /* already released */ }
    const move = (next) => {
      const { travel, overflow } = metrics()
      if (travel <= 0) return
      const delta = (axis === "y" ? next.clientY : next.clientX) - origin
      spec.set(scroller, start + (delta / travel) * overflow)
    }
    const stop = () => thumb.removeEventListener("pointermove", move)
    thumb.addEventListener("pointermove", move)
    thumb.addEventListener("pointerup", stop, { once: true })
    thumb.addEventListener("pointercancel", stop, { once: true })
  })

  return paint
}

/* axes is "both", "x", or "y". The scroller keeps its own scroll; the bars are siblings. */
const attachScrollbars = (scroller, axes) => {
  const row = document.createElement("div")
  row.className = "body-row"
  const main = document.createElement("div")
  main.className = "body-main"
  scroller.parentElement.insertBefore(row, scroller)
  main.append(scroller)
  row.append(main)
  const win = scroller.closest(".window")
  if (!scroller.id) scroller.id = `${win.id}-body`
  let paintY = () => {}
  let paintX = () => {}
  if (axes !== "x") {
    const vertical = makeScrollBar("y")
    main.append(vertical.bar)
    vertical.bar.setAttribute("aria-controls", scroller.id)
    paintY = bindScrollBar(scroller, "y", vertical)
  }
  if (axes !== "y") {
    const horizontal = makeScrollBar("x")
    row.append(horizontal.bar)
    horizontal.bar.setAttribute("aria-controls", scroller.id)
    paintX = bindScrollBar(scroller, "x", horizontal)
  }
  const sync = () => {
    const overflowY = axes !== "x" && scroller.scrollHeight - scroller.clientHeight > 1
    const overflowX = axes !== "y" && scroller.scrollWidth - scroller.clientWidth > 1
    row.classList.toggle("is-scroll-y", overflowY)
    row.classList.toggle("is-scroll-x", overflowX)
    if (overflowY) paintY()
    if (overflowX) paintX()
  }
  scroller.addEventListener("scroll", sync, { passive: true })
  new ResizeObserver(sync).observe(scroller)
  for (const child of scroller.children) new ResizeObserver(sync).observe(child)
  new MutationObserver(sync).observe(scroller, { childList: true, subtree: true, attributes: true, characterData: true })
  sync()
  return sync
}

const setupScrollbars = () => {
  for (const scroller of document.querySelectorAll(".desktop > .window > .window-body")) {
    attachScrollbars(scroller, "both")
  }
  attachScrollbars($("display-pane"), "both")
  attachScrollbars($("range-pane"), "x")
}

setupScrollbars()
activateWindow(topWindow())
for (const win of desktopWindows()) fitWindow(win)
window.addEventListener("resize", () => {
  for (const win of desktopWindows()) fitWindow(win)
})
FLOATING.addEventListener("change", () => {
  for (const win of desktopWindows()) fitWindow(win)
})

document.addEventListener("click", (event) => {
  const el = event.target instanceof Element ? event.target.closest("[data-action]") : null
  if (!el || el.getAttribute("aria-disabled") === "true") return
  if (el.closest(".menu-popup")) closeMenu(true)
  actions[el.dataset.action]?.(el)
})

/* ───────────── Menus ───────────── */

const allMenus = [...document.querySelectorAll(".menu")]
const barMenus = [...document.querySelectorAll(".menubar .menu")]
const triggerOf = (menu) => menu.querySelector(":scope > button")
const popupOf = (menu) => menu.querySelector(":scope > .menu-popup")
const itemsOf = (menu) =>
  [...popupOf(menu).querySelectorAll("button[role^='menuitem']")].filter((item) => !item.hidden)

let openMenu = null
let returnFocus = null

const setItems = (action, apply) => {
  for (const item of document.querySelectorAll(`.menu-popup [data-action="${action}"]`)) apply(item)
}
const setDisabled = (action, disabled) =>
  setItems(action, (item) => item.setAttribute("aria-disabled", String(Boolean(disabled))))

const syncMenuState = () => {
  setDisabled("open", fileInput.disabled)
  setDisabled("export", !usable(exportBtn))
  setDisabled("play", !usable(playBtn))
  setDisabled("rewind", !usable(rewindBtn))
  setDisabled("toggle-invert", invertInput.disabled)
  setItems("play", (item) => {
    item.firstElementChild.textContent = playBtn.classList.contains("is-playing") ? "Stop" : "Play range"
  })
  setItems("toggle-invert", (item) => item.setAttribute("aria-checked", String(invertInput.checked)))
  setItems("scheme", (item) => item.setAttribute("aria-checked", String(item.dataset.scheme === scheme)))
}

const closeMenu = (restoreFocus = false) => {
  if (!openMenu) return
  const menu = openMenu
  openMenu = null
  popupOf(menu).hidden = true
  triggerOf(menu).setAttribute("aria-expanded", "false")
  if (restoreFocus) {
    const target = returnFocus && document.contains(returnFocus) ? returnFocus : null
    if (target && target !== document.body) target.focus()
    else document.activeElement?.blur()
  }
  returnFocus = null
}

const showMenu = (menu, focusFirst = false) => {
  if (openMenu === menu) return
  const previous = returnFocus
  closeMenu()
  returnFocus = previous ?? (menu.contains(document.activeElement) ? null : document.activeElement)
  syncMenuState()
  openMenu = menu
  popupOf(menu).hidden = false
  triggerOf(menu).setAttribute("aria-expanded", "true")
  if (focusFirst) itemsOf(menu)[0]?.focus()
}

for (const menu of allMenus) {
  const trigger = triggerOf(menu)
  const popup = popupOf(menu)

  trigger.addEventListener("click", (event) => {
    if (openMenu === menu) closeMenu(true)
    else showMenu(menu, event.detail === 0)
  })

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || (event.key === "ArrowUp" && menu.classList.contains("menu-start"))) {
      event.preventDefault()
      showMenu(menu, true)
    }
  })

  trigger.addEventListener("pointerenter", () => {
    if (openMenu && openMenu !== menu && barMenus.includes(menu) && barMenus.includes(openMenu)) showMenu(menu)
  })

  popup.addEventListener("pointermove", (event) => {
    const item = event.target instanceof Element ? event.target.closest("button[role^='menuitem']") : null
    if (item && document.activeElement !== item) item.focus()
  })

  popup.addEventListener("keydown", (event) => {
    const items = itemsOf(menu)
    const index = items.indexOf(document.activeElement)
    const move = (to) => {
      event.preventDefault()
      items[(to + items.length) % items.length]?.focus()
    }
    const barIndex = barMenus.indexOf(menu)
    switch (event.key) {
      case "ArrowDown":
        return move(index + 1)
      case "ArrowUp":
        return move(index - 1)
      case "Home":
        return move(0)
      case "End":
        return move(items.length - 1)
      case "ArrowRight":
      case "ArrowLeft":
        if (barIndex < 0) return
        event.preventDefault()
        showMenu(barMenus[(barIndex + (event.key === "ArrowRight" ? 1 : -1) + barMenus.length) % barMenus.length], true)
        return
      case "Escape":
        event.preventDefault()
        closeMenu(false)
        trigger.focus()
        return
      case "Tab":
        closeMenu(false)
        return
    }
  })
}

document.addEventListener("pointerdown", (event) => {
  if (openMenu && !(event.target instanceof Element && openMenu.contains(event.target))) closeMenu()
})

/* ───────────── Keyboard shortcuts ───────────── */

document.addEventListener("keydown", (event) => {
  if (aboutDialog.open || howDialog.open) return

  // Alt+F / Alt+V / Alt+H open the menus
  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    const menu = barMenus.find((m) => triggerOf(m).dataset.key === event.key.toLowerCase())
    if (menu) {
      event.preventDefault()
      showMenu(menu, true)
    }
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
    event.preventDefault()
    openPicker()
    return
  }

  if (event.key === "Escape" && openMenu) {
    closeMenu(true)
    return
  }

  if (event.code !== "Space" || event.repeat || event.ctrlKey || event.metaKey || openMenu) return
  const t = event.target
  if (t instanceof HTMLElement) {
    if (t.isContentEditable || t.closest("button, summary, select, textarea, canvas, [role='button']")) return
    if (t instanceof HTMLInputElement && t.type !== "range") return
  }
  if (!usable(playBtn)) return
  event.preventDefault()
  playBtn.click()
})

/* Trackpad / mouse wheel over sliders should not scroll the page */
document.addEventListener(
  "wheel",
  (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.type !== "range") return
    event.preventDefault()
  },
  { passive: false },
)

/* ───────────── Display zoom ───────────── */

/** Zoom resizes the canvas box; keep the page from jumping when already scrolled. */
let zoomScrollLock = null

const lockScrollForZoom = () => {
  if (zoomScrollLock === null) zoomScrollLock = window.scrollY
}

const restoreScrollAfterZoom = () => {
  if (zoomScrollLock === null) return
  const y = zoomScrollLock
  window.scrollTo(0, y)
  requestAnimationFrame(() => window.scrollTo(0, y))
}

scaleInput.addEventListener("pointerdown", lockScrollForZoom, { capture: true })
scaleInput.addEventListener("focus", lockScrollForZoom, { capture: true })
scaleInput.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
      lockScrollForZoom()
    }
  },
  { capture: true },
)
scaleInput.addEventListener("input", restoreScrollAfterZoom)
scaleInput.addEventListener("pointerup", () => {
  restoreScrollAfterZoom()
  zoomScrollLock = null
})
scaleInput.addEventListener("blur", () => {
  zoomScrollLock = null
})

// main.js only redraws on zoom once media is loaded; keep the blank display in step too
const drawBlank = () => {
  const cell = Math.max(1, Number(scaleInput.value) | 0)
  canvas.width = 26 * cell
  canvas.height = 27 * cell
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = cssVar("--pixel-off")
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}
scaleInput.addEventListener("input", () => {
  if (body.dataset.media === "none") drawBlank()
})

/* When the video range is wider than the column beside the console, it takes
   that whole bottom row and the console is removed. Widening the window puts
   the console back. A still-narrow range scrolls inside its own pane. */
const workspace = document.querySelector(".workspace")

const layoutWorkspace = () => {
  if (!SIDE_BY_SIDE.matches) {
    workspace.classList.remove("is-console-collapsed")
    return
  }
  const header = timeline.querySelector(".video-trimmer-header")
  const fps = timeline.querySelector(".field-fps")
  const side = workspace.querySelector(".col-side")
  if (!header || !fps || !side) return
  const styles = getComputedStyle(workspace)
  const group = getComputedStyle(timeline)
  const inner = workspace.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
  const gap = parseFloat(styles.columnGap) || 0
  const beside = inner - side.offsetWidth - gap - parseFloat(group.paddingLeft) - parseFloat(group.paddingRight)
  const need = Math.max(header.offsetWidth, fps.offsetWidth)
  workspace.classList.toggle("is-console-collapsed", need > beside + 1)
}

layoutWorkspace()
new ResizeObserver(layoutWorkspace).observe(workspace)
const rangeHeader = timeline.querySelector(".video-trimmer-header")
const rangeFps = timeline.querySelector(".field-fps")
if (rangeHeader) new ResizeObserver(layoutWorkspace).observe(rangeHeader)
if (rangeFps) new ResizeObserver(layoutWorkspace).observe(rangeFps)
SIDE_BY_SIDE.addEventListener("change", layoutWorkspace)
document.fonts?.ready.then(layoutWorkspace)

/* Video range stays on screen; when main.js hides it (no video) it becomes inert */
const syncTimeline = () => {
  timeline.inert = timeline.hidden
  updateSummary()
}
new MutationObserver(syncTimeline).observe(timeline, { attributes: true, attributeFilter: ["hidden"] })

/* ───────────── How it works: live note map ───────────── */

const howCanvas = $("how-canvas")
const howCtx = howCanvas.getContext("2d")
const howNumbers = $("how-numbers")
const howNote = $("how-note")
const howVelocity = $("how-velocity")
const howSum = $("how-sum")
const howBits = [...$("how-bits").children]

const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
const luma = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114
const cssLuma = (name) => {
  probe.fillStyle = cssVar(name) || "#000"
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return luma(r, g, b)
}
const onLuma = cssLuma("--pixel-on")
const offLuma = cssLuma("--pixel-off")
const isLit = (r, g, b) => Math.abs(luma(r, g, b) - onLuma) < Math.abs(luma(r, g, b) - offLuma)

// Read the preview back as a 26×27 grid (nearest-neighbour downscale lands on each cell)
const tiny = document.createElement("canvas")
tiny.width = 26
tiny.height = 27
const tinyCtx = tiny.getContext("2d", { willReadFrequently: true })
const readGrid = () => {
  tinyCtx.imageSmoothingEnabled = false
  tinyCtx.clearRect(0, 0, 26, 27)
  tinyCtx.drawImage(canvas, 0, 0, 26, 27)
  const { data } = tinyCtx.getImageData(0, 0, 26, 27)
  const grid = new Uint8Array(26 * 27)
  for (let i = 0; i < grid.length; i += 1) grid[i] = isLit(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) ? 1 : 0
  return grid
}

const patternOf = (grid, col, row) => {
  let pattern = 0
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 2; sx += 1) {
      if (grid[(row * 3 + sy) * 26 + col * 2 + sx]) pattern |= 1 << (sy * 2 + sx)
    }
  }
  return pattern
}

const noteOf = ({ col, row }) => 127 - (row * 13 + col)

let selected = { col: 6, row: 4 }
let hovered = null
let lastKey = ""
let howFrame = 0

const CELL = howCanvas.width / 26

const drawHow = (grid) => {
  const on = cssVar("--pixel-on")
  const off = cssVar("--pixel-off")
  const W = howCanvas.width
  const H = howCanvas.height
  howCtx.fillStyle = off
  howCtx.fillRect(0, 0, W, H)

  howCtx.fillStyle = on
  for (let y = 0; y < 27; y += 1) {
    for (let x = 0; x < 26; x += 1) {
      if (grid[y * 26 + x]) howCtx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
    }
  }

  // Block boundaries (13 × 9)
  howCtx.fillStyle = "rgb(255 255 255 / 0.8)"
  for (let c = 1; c < 13; c += 1) howCtx.fillRect(c * 2 * CELL - 1, 0, 2, H)
  for (let r = 1; r < 9; r += 1) howCtx.fillRect(0, r * 3 * CELL - 1, W, 2)

  if (howNumbers.checked) {
    const dot = CELL / 6 // 4 canvas px at the default size
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 13; col += 1) {
        const label = String(noteOf({ col, row }))
        const w = textWidth(label) * dot
        const x0 = Math.round((col * 2 + 1) * CELL - w / 2)
        const y0 = Math.round((row * 3 + 1.5) * CELL - 2.5 * dot)
        howCtx.fillStyle = off
        howCtx.fillRect(x0 - dot, y0 - dot, w + 2 * dot, 7 * dot)
        howCtx.fillStyle = on
        plotText(label, 0, 0, (x, y) => howCtx.fillRect(x0 + x * dot, y0 + y * dot, dot, dot))
      }
    }
  }

  const outline = ({ col, row }, inner, outer) => {
    const x = col * 2 * CELL
    const y = row * 3 * CELL
    howCtx.lineWidth = 6
    howCtx.strokeStyle = outer
    howCtx.strokeRect(x + 3, y + 3, 2 * CELL - 6, 3 * CELL - 6)
    howCtx.lineWidth = 2
    howCtx.strokeStyle = inner
    howCtx.strokeRect(x + 3, y + 3, 2 * CELL - 6, 3 * CELL - 6)
  }
  if (hovered && (hovered.col !== selected.col || hovered.row !== selected.row)) outline(hovered, "#fff", "rgb(0 0 0 / 0.6)")
  outline(selected, "#fff", "#000080")
}

const describeBlock = (grid) => {
  const block = hovered ?? selected
  const pattern = patternOf(grid, block.col, block.row)
  howNote.textContent = String(noteOf(block))
  howVelocity.textContent = pattern ? String(pattern) : "off"
  const parts = []
  howBits.forEach((cell, i) => {
    const lit = Boolean(pattern & (1 << i))
    cell.classList.toggle("on", lit)
    if (lit) parts.push(1 << i)
  })
  howSum.textContent = pattern
    ? `${parts.join(" + ")} = ${pattern}`
    : "No lit pixels, so this block sends no note."
}

const howFrameStep = () => {
  howFrame = 0
  if (!howDialog.open || document.hidden) return
  const grid = readGrid()
  const key = `${grid.join("")}|${hovered?.col},${hovered?.row}|${selected.col},${selected.row}|${howNumbers.checked}`
  if (key !== lastKey) {
    lastKey = key
    drawHow(grid)
    describeBlock(grid)
  }
  howFrame = requestAnimationFrame(howFrameStep)
}

function startHowLoop() {
  if (!howFrame) howFrame = requestAnimationFrame(howFrameStep)
}

howDialog.addEventListener("close", () => {
  hovered = null
  lastKey = ""
})
document.addEventListener("visibilitychange", startHowLoop)
howNumbers.addEventListener("change", startHowLoop)
document.fonts?.ready.then(() => {
  lastKey = ""
  startHowLoop()
})

const blockAt = (event) => {
  const rect = howCanvas.getBoundingClientRect()
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * 26)
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * 27)
  if (x < 0 || y < 0 || x >= 26 || y >= 27) return null
  return { col: x >> 1, row: Math.floor(y / 3) }
}

howCanvas.addEventListener("pointermove", (event) => {
  hovered = blockAt(event)
  startHowLoop()
})
howCanvas.addEventListener("pointerleave", () => {
  hovered = null
  startHowLoop()
})
howCanvas.addEventListener("click", (event) => {
  const block = blockAt(event)
  if (block) selected = block
  startHowLoop()
})
howCanvas.addEventListener("keydown", (event) => {
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  selected = {
    col: Math.min(12, Math.max(0, selected.col + move[0])),
    row: Math.min(8, Math.max(0, selected.row + move[1])),
  }
  hovered = null
  startHowLoop()
})

/* ───────────── Range summary ───────────── */

const startOut = $("export-frame-start-readout")
const endOut = $("export-frame-end-readout")
const fpsOut = $("export-fps-value")
const summary = $("ui-range-summary")

function updateSummary() {
  if (timeline.hidden) {
    summary.textContent = "Open a video to choose a range."
    return
  }
  const count = Math.max(0, Number(endOut.textContent) - Number(startOut.textContent) + 1)
  const fps = Number(fpsOut.textContent) || 30
  summary.textContent = `${count.toLocaleString()} frame${count === 1 ? "" : "s"} selected (${(count / fps).toFixed(1)} s at ${fps} fps)`
}

const summaryObserver = new MutationObserver(updateSummary)
for (const el of [startOut, endOut, fpsOut]) {
  summaryObserver.observe(el, { childList: true, characterData: true, subtree: true })
}
updateSummary()
syncTimeline()
