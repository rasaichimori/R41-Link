# R41 Link

Companion web app for the **Audiotool Nexus R41** hardware display. Upload an image, GIF, or video, preview it as a **26×27** black-and-white pixel grid (the same logical resolution as the lcd-visualizer **MIDI** mode on the FMX LCD Visualizer plugin), and download a **Standard MIDI File** that encodes the frame using R41 note/pattern conventions.

## Relation to lcd-visualizer / Nexus

The FMX [lcd-visualizer](../audiotool/fmx-plugins/lcd-visualizer) plugin renders a dynamic UI grid, but in **MIDI mode** the R41-facing layout is fixed:

| Constant | Value |
| -------- | ----- |
| Logical pixels | **26 × 27** |
| MIDI blocks | **13 × 9** = 117 |
| Pixels per block | **2 × 3** |
| MIDI notes | **11–127** (note `127` = top-left block) |
| Pattern | **6-bit** glyph per block, sent as **velocity 1–63** (see `velocity_to_pattern` in `lcd-visualizer/dsp/visualizer.rs`) |

R41 Link does **not** embed the plugin UI or WASM DSP. It reuses the same grid geometry and MIDI mapping so files produced here should align with what the hardware expects when driven via MIDI from Nexus.

## Quick start

```bash
cd /Users/rasa/R41-Link
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Usage

1. Drop or select **image**, **GIF**, or **video**.
2. Adjust **threshold** (luma ≥ threshold → lit pixel).
3. For video, scrub **video frame** (exports use the current frame for now).
4. **Export MIDI** — one frame → single set of note-ons; velocity = block pattern 1–63.
5. **Export PNG** — upscaled preview for sharing.

## Project layout

```
R41-Link/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── main.js       # upload UI, video scrubbing
    ├── constants.js  # 26×27 / MIDI block constants
    ├── raster.js     # media → binary grid
    ├── preview.js    # scaled canvas preview
    ├── midi.js       # grid → SMF encoder
    └── style.css
```

## Implemented vs stubbed

| Feature | Status |
| ------- | ------ |
| Image upload (PNG, JPEG, WebP, …) | **Working** |
| Video upload + frame scrub | **Working** |
| GIF upload | **First frame only** (browser decodes as animated `<img>`; no multi-frame export yet) |
| 26×27 luma threshold raster | **Working** |
| Scaled B&W preview | **Working** |
| MIDI export (static / single frame) | **Working** (Format 0 SMF, note 11–127, velocity = pattern) |
| Full video timeline MIDI | **Stub** — exports current frame; TODO: sample at FPS |
| Animated GIF MIDI sequence | **Stub** — TODO: frame decoder + tick stream |
| Exact velocity curve for patterns &gt; 64 via host scaling | **N/A** — patterns are 0–63; velocities 1–63 match plugin |

## MIDI mapping decisions

- Each **2×3** block is read row-major into a **6-bit** integer (same bit order as `lcd-visualizer/ui/js/scenes/midi.js`: `bit = sy * 2 + sx`).
- **Pattern 0** → no note (empty block).
- **Pattern 1–63** → `Note On` on channel 1 with `velocity = pattern` (matches `noteOn` / `midiPattern` for velocities ≤ 64).
- **Note number** = `127 - blockIndex` with blocks counted left-to-right, top-to-bottom (`13` columns).
- Multi-frame export uses **480 ticks per frame** at **120 BPM** by default; consecutive frames emit note-offs before the next frame’s note-ons.

## License

Private scaffold — add a license when you publish.
