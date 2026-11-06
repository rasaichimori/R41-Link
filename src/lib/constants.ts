/** R41 / lcd-visualizer MIDI logical display */
export const GRID_W = 26
export const GRID_H = 27
export const GRID_SIZE = GRID_W * GRID_H

export const MIDI_COLS = 13
export const MIDI_ROWS = 9
export const MIDI_BLOCK_COUNT = MIDI_COLS * MIDI_ROWS
export const MIDI_BLOCK_W = 2
export const MIDI_BLOCK_H = 3

export const MIDI_NOTE_MAX = 127
export const MIDI_NOTE_MIN = MIDI_NOTE_MAX - MIDI_BLOCK_COUNT + 1

/** Default ticks per frame when exporting animated media */
export const DEFAULT_TICKS_PER_FRAME = 480

/** Video timeline sampling rate for full MIDI export */
export const DEFAULT_EXPORT_FPS = 30
export const MIN_EXPORT_FPS = 1
export const MAX_EXPORT_FPS = 60

export const DEFAULT_BPM = 120
export const MIN_BPM = 1
export const MAX_BPM = 999

export const EMPTY_GRID = new Uint8Array(GRID_SIZE)
