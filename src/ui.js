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
const appWindow = $("app-window")
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
  document.title = loaded ? `${fileName.textContent} - R41 Link` : "R41 Link"
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

/* ───────────── Window ───────────── */

appWindow.querySelector(".title-bar").addEventListener("dblclick", (event) => {
  if (!event.target.closest(".title-controls")) actions.maximize(appWindow.querySelector('[data-action="maximize"]'))
})

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
  "focus-app": () => appWindow.scrollIntoView({ block: "nearest" }),
  scheme: (el) => setScheme(el.dataset.scheme),
  maximize: (el) => {
    const on = appWindow.classList.toggle("is-maximized")
    el.setAttribute("aria-pressed", String(on))
    el.setAttribute("aria-label", on ? "Restore" : "Maximize")
  },
}

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

/* ───────────── Display: zoom fits the bay ───────────── */

const bay = document.querySelector(".lcd-bay")

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

// The bay never changes size; cap zoom at the largest size that fits inside it,
// and return to the zoom you chose whenever there's room again
let desiredZoom = Number(scaleInput.value)
scaleInput.addEventListener("input", (event) => {
  if (event.isTrusted) desiredZoom = Number(scaleInput.value)
})

const fitZoom = () => {
  const w = bay.clientWidth
  const h = bay.clientHeight
  if (!(w > 26 && h > 27)) return // not laid out yet
  const max = Math.max(4, Math.min(24, Math.floor(Math.min(w / 26, h / 27))))
  scaleInput.max = String(max)
  const next = String(Math.min(desiredZoom, max))
  if (scaleInput.value !== next) {
    scaleInput.value = next
    scaleInput.dispatchEvent(new Event("input"))
  }
}
new ResizeObserver(fitZoom).observe(bay)

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
