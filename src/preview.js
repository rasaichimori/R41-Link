import { GRID_H, GRID_W } from "./constants.js"

export const drawGrid = (canvas, grid, scale) => {
  const cell = Math.max(1, scale | 0)
  const w = GRID_W * cell
  const h = GRID_H * cell
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--pixel-off").trim() || "#101812"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--pixel-on").trim() || "#e8f2e6"
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (!grid[y * GRID_W + x]) continue
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }
}
