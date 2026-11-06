import { GRID_H, GRID_W } from "./constants"
import { pixelColors } from "./preview"

/** Pixel glyphs (3×5) for text drawn in display pixels */
const GLYPHS: Record<string, string[]> = {
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
export const plotText = (text: string, x0: number, y0: number, dot: (x: number, y: number) => void) => {
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

export const textWidth = (text: string) =>
  [...text].reduce((w, ch) => w + (GLYPHS[ch]?.[0].length ?? 0) + 1, 0) - 1

const ARROW = ["..XXX..", "..XXX..", "..XXX..", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."]

/** Drag feedback drawn in display pixels: a down arrow over "DROP". */
export const drawDropOverlay = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const { on, off } = pixelColors()
  ctx.fillStyle = off
  ctx.fillRect(0, 0, GRID_W, GRID_H)
  ctx.fillStyle = on
  const top = 6
  ARROW.forEach((row, y) => [...row].forEach((c, x) => c === "X" && ctx.fillRect(10 + x - 1, top + y, 1, 1)))
  plotText("DROP", Math.floor((GRID_W - textWidth("DROP")) / 2), top + ARROW.length + 3, (x, y) =>
    ctx.fillRect(x, y, 1, 1),
  )
}
