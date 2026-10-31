import {
  DEFAULT_TICKS_PER_FRAME,
  GRID_W,
  MIDI_BLOCK_COUNT,
  MIDI_BLOCK_H,
  MIDI_BLOCK_W,
  MIDI_COLS,
  MIDI_NOTE_MAX,
  GRID_H,
} from "./constants.js"

/** Match lcd-visualizer `midiPattern` / DSP `velocity_to_pattern` inverse for 1–63. */
export const patternToVelocity = (pattern) => {
  const value = pattern | 0
  if (value <= 0) return 0
  if (value <= 63) return value
  return 63
}

export const noteForBlock = (blockIndex) => MIDI_NOTE_MAX - (blockIndex | 0)

/** 6-bit pattern from one 2×3 block (bit order matches midi.js). */
export const patternFromBlock = (grid, blockCol, blockRow) => {
  let pattern = 0
  for (let sy = 0; sy < MIDI_BLOCK_H; sy += 1) {
    for (let sx = 0; sx < MIDI_BLOCK_W; sx += 1) {
      const x = blockCol * MIDI_BLOCK_W + sx
      const y = blockRow * MIDI_BLOCK_H + sy
      if (grid[y * GRID_W + x]) {
        pattern |= 1 << (sy * MIDI_BLOCK_W + sx)
      }
    }
  }
  return pattern
}

/**
 * @param {Uint8Array} grid
 * @returns {{ note: number, velocity: number }[]}
 */
export const gridToNoteEvents = (grid) => {
  const events = []
  for (let block = 0; block < MIDI_BLOCK_COUNT; block += 1) {
    const col = block % MIDI_COLS
    const row = (block / MIDI_COLS) | 0
    const pattern = patternFromBlock(grid, col, row)
    const velocity = patternToVelocity(pattern)
    if (velocity <= 0) continue
    events.push({ note: noteForBlock(block), velocity })
  }
  return events
}

const writeVarLen = (value) => {
  const bytes = []
  let buffer = value & 0x7f
  while ((value >>= 7)) {
    buffer <<= 8
    buffer |= (value & 0x7f) | 0x80
  }
  while (true) {
    bytes.push(buffer & 0xff)
    if (buffer & 0x80) buffer >>= 8
    else break
  }
  return bytes
}

const u32be = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]

const u16be = (n) => [(n >>> 8) & 0xff, n & 0xff]

const strBytes = (s) => {
  const out = []
  for (let i = 0; i < s.length; i += 1) out.push(s.charCodeAt(i))
  return out
}

/**
 * Build a Format 0 SMF from one or more frames of grid data.
 * @param {Uint8Array[]} frames
 * @param {{ ticksPerFrame?: number, bpm?: number }} [options]
 */
export const encodeSmf = (frames, options = {}) => {
  const ticksPerFrame = options.ticksPerFrame ?? DEFAULT_TICKS_PER_FRAME
  const bpm = options.bpm ?? 120
  const microPerQuarter = Math.round(60_000_000 / bpm)
  const name = "R41 Link"

  const track = []
  track.push(...writeVarLen(0), 0xff, 0x51, 0x03, ...u32be(microPerQuarter).slice(1))
  track.push(...writeVarLen(0), 0xff, 0x03, name.length, ...strBytes(name))

  let tick = 0
  const safeFrames = frames.length > 0 ? frames : [new Uint8Array(GRID_W * GRID_H)]

  for (let frameIndex = 0; frameIndex < safeFrames.length; frameIndex += 1) {
    const frameStart = frameIndex * ticksPerFrame
    const notes = gridToNoteEvents(safeFrames[frameIndex])
    let firstInFrame = true

    for (const { note, velocity } of notes) {
      const delta = firstInFrame ? frameStart - tick : 0
      track.push(...writeVarLen(Math.max(0, delta)), 0x90, note & 0x7f, velocity & 0x7f)
      tick += delta
      firstInFrame = false
    }

    if (notes.length > 0) {
      const offAt = (frameIndex + 1) * ticksPerFrame
      let firstOff = true
      for (const { note } of notes) {
        const delta = firstOff ? offAt - tick : 0
        track.push(...writeVarLen(Math.max(0, delta)), 0x80, note & 0x7f, 0)
        tick += delta
        firstOff = false
      }
    }
  }

  const endAt = safeFrames.length * ticksPerFrame
  track.push(...writeVarLen(Math.max(0, endAt - tick)), 0xff, 0x2f, 0x00)

  const header = [
    0x4d,
    0x54,
    0x68,
    0x64,
    ...u32be(6),
    ...u16be(0),
    ...u16be(1),
    ...u16be(480),
  ]
  const trackChunk = [0x4d, 0x54, 0x72, 0x6b, ...u32be(track.length), ...track]
  return new Uint8Array([...header, ...trackChunk])
}

/** @param {Uint8Array[]} frames */
export const countNoteEvents = (frames) => {
  let total = 0
  for (const frame of frames) total += gridToNoteEvents(frame).length
  return total
}

export const downloadMidi = (frames, filename = "r41-link.mid", options) => {
  const bytes = encodeSmf(frames, options)
  const blob = new Blob([bytes], { type: "audio/midi" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
