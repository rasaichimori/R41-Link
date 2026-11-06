<script lang="ts">
  import { getApp } from "../../lib/context"

  const { converter, actions } = getApp()
</script>

<section class="group panel-convert" aria-labelledby="settings-heading">
  <h2 class="group-title" id="settings-heading">Conversion</h2>
  <div class="field">
    <div class="field-row">
      <label class="field-label" for="threshold">Threshold:</label>
      <output class="field-readout" for="threshold">{converter.threshold}</output>
    </div>
    <input
      type="range"
      class="trackbar trackbar-luma"
      id="threshold"
      min="0"
      max="255"
      value={converter.threshold}
      aria-describedby="threshold-hint"
      oninput={(event) => converter.setThreshold(Number(event.currentTarget.value))}
      onchange={converter.commitThreshold}
    />
    <div class="trackbar-ends" aria-hidden="true"><span>Dark</span><span>Light</span></div>
    <p class="field-hint" id="threshold-hint">
      Pixels brighter than this light up. It’s set automatically when a file opens.
    </p>
  </div>
  <label class="checkbox">
    <input
      type="checkbox"
      checked={converter.invert}
      onchange={(event) => actions.setInvert(event.currentTarget.checked)}
    />
    <span>Invert (light the dark areas)</span>
  </label>
</section>
