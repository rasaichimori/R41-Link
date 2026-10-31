import { GRID_W, GRID_H, GRID_SIZE } from "./constants.js"

const sampleCanvas = document.createElement("canvas")
const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true })

const drawSourceToSampleCanvas = (source) => {
  sampleCanvas.width = GRID_W
  sampleCanvas.height = GRID_H
  sampleCtx.fillStyle = "#000"
  sampleCtx.fillRect(0, 0, GRID_W, GRID_H)

  const sw = "videoWidth" in source ? source.videoWidth : source.width
  const sh = "videoHeight" in source ? source.videoHeight : source.height
  if (!sw || !sh) return false

  const scale = Math.max(GRID_W / sw, GRID_H / sh)
  const dw = sw * scale
  const dh = sh * scale
  const dx = (GRID_W - dw) * 0.5
  const dy = (GRID_H - dh) * 0.5
  sampleCtx.drawImage(source, dx, dy, dw, dh)
  return true
}

/**
 * @param {CanvasImageSource} source
 * @returns {Uint8Array | null} per-pixel luma 0–255, or null if source has no size
 */
export const sampleSourceLuma = (source) => {
  if (!drawSourceToSampleCanvas(source)) return null
  const { data } = sampleCtx.getImageData(0, 0, GRID_W, GRID_H)
  const lumas = new Uint8Array(GRID_SIZE)
  for (let i = 0; i < GRID_SIZE; i += 1) {
    const o = i * 4
    lumas[i] =
      data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114
  }
  return lumas
}

/** Otsu threshold on 8-bit luma (good default for line art / photos). */
export const otsuThreshold = (lumas) => {
  const hist = new Uint32Array(256)
  for (let i = 0; i < lumas.length; i += 1) hist[lumas[i]] += 1

  const total = lumas.length
  let sum = 0
  for (let t = 0; t < 256; t += 1) sum += t * hist[t]

  let sumB = 0
  let wB = 0
  let maxVar = 0
  let threshold = 128

  for (let t = 0; t < 256; t += 1) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const varBetween = wB * wF * (mB - mF) ** 2
    if (varBetween > maxVar) {
      maxVar = varBetween
      threshold = t
    }
  }
  return threshold
}

/**
 * @param {Uint8Array} lumas
 * @param {number} threshold 0–255
 * @param {boolean} [invert]
 */
export const lumaToGrid = (lumas, threshold, invert = false) => {
  const grid = new Uint8Array(GRID_SIZE)
  for (let i = 0; i < GRID_SIZE; i += 1) {
    const bright = lumas[i] >= threshold
    grid[i] = invert ? (bright ? 0 : 1) : bright ? 1 : 0
  }
  return grid
}

/**
 * Draw `source` into GRID_W×GRID_H and threshold to 0/1 grid (row-major).
 * @param {CanvasImageSource} source
 * @param {number} threshold 0–255
 * @param {boolean} [invert]
 * @returns {Uint8Array}
 */
export const sampleToGrid = (source, threshold, invert = false) => {
  const lumas = sampleSourceLuma(source)
  if (!lumas) return new Uint8Array(GRID_SIZE)
  return lumaToGrid(lumas, threshold, invert)
}
