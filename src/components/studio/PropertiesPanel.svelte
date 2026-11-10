<script lang="ts">
  import { getApp } from "../../lib/context"
  import StudioIcon from "./StudioIcon.svelte"

  const { studio } = getApp()

  const syncNumber = (source: () => number) => (node: HTMLInputElement) => {
    if (document.activeElement !== node) node.value = String(source())
  }
</script>

<section class="group props-panel" aria-labelledby="props-title">
  <h2 class="group-title" id="props-title">Properties</h2>
  <div class="props">
    <span class="prop prop-doc"><StudioIcon name="doc" />Document</span>
    <span class="prop">Size: <span class="field-readout prop-static">26 × 27</span> px</span>
    <label class="prop">
      Frame rate:
      <input
        class="text-field"
        type="number"
        id="fps"
        min="1"
        max="60"
        step="1"
        inputmode="numeric"
        {@attach syncNumber(() => studio.fps)}
        oninput={(event) => studio.setFps(event.currentTarget.value)}
        onchange={(event) => {
          studio.setFps(event.currentTarget.value)
          event.currentTarget.value = String(studio.fps)
        }}
      />
      fps
    </label>
    <label class="prop">
      Tempo:
      <input
        class="text-field"
        type="number"
        id="bpm"
        min="1"
        max="999"
        step="1"
        inputmode="numeric"
        {@attach syncNumber(() => studio.bpm)}
        oninput={(event) => studio.setBpm(event.currentTarget.value)}
        onchange={(event) => {
          studio.setBpm(event.currentTarget.value)
          event.currentTarget.value = String(studio.bpm)
        }}
      />
      BPM
    </label>
    <span class="prop">MIDI notes: <output class="notes-readout">{studio.notesLabel}</output></span>
    <button type="button" class="btn btn-default prop-export" onclick={() => studio.perform("export")}>Export MIDI...</button>
  </div>
</section>
