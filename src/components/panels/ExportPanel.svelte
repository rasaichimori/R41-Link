<script lang="ts">
  import { MAX_BPM, MIN_BPM } from "../../lib/constants"
  import { getApp } from "../../lib/context"

  const { converter, actions } = getApp()
</script>

<section class="group panel-actions" aria-labelledby="export-heading">
  <h2 class="group-title" id="export-heading">Export</h2>
  <div class="field-grid">
    <label class="field-label" for="bpm">Tempo:</label>
    <span class="unit-readout">
      <input
        class="text-field"
        type="number"
        id="bpm"
        min={MIN_BPM}
        max={MAX_BPM}
        step="1"
        inputmode="numeric"
        bind:value={converter.bpmInput}
      />
      BPM
    </span>
    <span class="field-label">MIDI notes:</span>
    <output class="notes-readout" aria-live="polite">{converter.notesText}</output>
  </div>
  <div class="actions">
    {#if converter.video}
      <button type="button" class="btn btn-default" disabled={converter.exportDisabled} onclick={actions.exportMidi}>
        Export MIDI...
      </button>
    {:else}
      <p class="actions-empty">Open a video to export MIDI.</p>
    {/if}
  </div>
</section>
