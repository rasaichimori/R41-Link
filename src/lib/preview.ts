import { GRID_H, GRID_W } from "./constants"

export const cssVar = (name: string, fallback = "") =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

export const pixelColors = () => ({
  on: cssVar("--pixel-on", "#1f2a12"),
  off: cssVar("--pixel-off", "#a9bb5c"),
})

export const drawGrid = (canvas: HTMLCanvasElement, grid: Uint8Array, scale: number) => {
  const cell = Math.max(1, scale | 0)
  const w = GRID_W * cell
  const h = GRID_H * cell
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const { on, off } = pixelColors()
  ctx.fillStyle = off
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = on
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (!grid[y * GRID_W + x]) continue
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }
}
