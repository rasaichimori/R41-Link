import { GRID_H, GRID_W, MIDI_BLOCK_H, MIDI_BLOCK_W, MIDI_COLS, MIDI_ROWS } from "./constants"
import { plotText, textWidth } from "./glyphs"
import { noteForBlock } from "./midi"
import { pixelColors } from "./preview"

export type Block = { col: number; row: number }

export const noteOfBlock = ({ col, row }: Block) => noteForBlock(row * MIDI_COLS + col)

export const sameBlock = (a: Block | null, b: Block | null) => a?.col === b?.col && a?.row === b?.row

export const clampBlock = ({ col, row }: Block): Block => ({
  col: Math.min(MIDI_COLS - 1, Math.max(0, col)),
  row: Math.min(MIDI_ROWS - 1, Math.max(0, row)),
})

/** Block under a client point on a canvas showing the full display, or null outside it. */
export const blockAtPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number): Block | null => {
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor(((clientX - rect.left) / rect.width) * GRID_W)
  const y = Math.floor(((clientY - rect.top) / rect.height) * GRID_H)
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null
  return { col: Math.floor(x / MIDI_BLOCK_W), row: Math.floor(y / MIDI_BLOCK_H) }
}

type NoteMapState = { selected: Block; hovered: Block | null; showNumbers: boolean }

export const drawNoteMap = (canvas: HTMLCanvasElement, grid: Uint8Array, state: NoteMapState) => {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const { on, off } = pixelColors()
  const W = canvas.width
  const H = canvas.height
  const cell = W / GRID_W
  ctx.fillStyle = off
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = on
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (grid[y * GRID_W + x]) ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2)
    }
  }

  ctx.fillStyle = "rgb(255 255 255 / 0.8)"
  for (let c = 1; c < MIDI_COLS; c += 1) ctx.fillRect(c * MIDI_BLOCK_W * cell - 1, 0, 2, H)
  for (let r = 1; r < MIDI_ROWS; r += 1) ctx.fillRect(0, r * MIDI_BLOCK_H * cell - 1, W, 2)

  if (state.showNumbers) {
    const dot = cell / 6 // 4 canvas px at the default size
    for (let row = 0; row < MIDI_ROWS; row += 1) {
      for (let col = 0; col < MIDI_COLS; col += 1) {
        const label = String(noteOfBlock({ col, row }))
        const w = textWidth(label) * dot
        const x0 = Math.round((col * 2 + 1) * cell - w / 2)
        const y0 = Math.round((row * 3 + 1.5) * cell - 2.5 * dot)
        ctx.fillStyle = off
        ctx.fillRect(x0 - dot, y0 - dot, w + 2 * dot, 7 * dot)
        ctx.fillStyle = on
        plotText(label, 0, 0, (x, y) => ctx.fillRect(x0 + x * dot, y0 + y * dot, dot, dot))
      }
    }
  }

  const outline = ({ col, row }: Block, inner: string, outer: string) => {
    const x = col * MIDI_BLOCK_W * cell
    const y = row * MIDI_BLOCK_H * cell
    ctx.lineWidth = 6
    ctx.strokeStyle = outer
    ctx.strokeRect(x + 3, y + 3, MIDI_BLOCK_W * cell - 6, MIDI_BLOCK_H * cell - 6)
    ctx.lineWidth = 2
    ctx.strokeStyle = inner
    ctx.strokeRect(x + 3, y + 3, MIDI_BLOCK_W * cell - 6, MIDI_BLOCK_H * cell - 6)
  }
  if (state.hovered && !sameBlock(state.hovered, state.selected)) outline(state.hovered, "#fff", "rgb(0 0 0 / 0.6)")
  outline(state.selected, "#fff", "#000080")
}
