<script lang="ts">
  import { MAX_EXPORT_FPS, MIN_EXPORT_FPS } from "../../lib/constants"
  import { rangeBounds } from "../../lib/attachments"
  import { getApp } from "../../lib/context"
  import PixelIcon from "../PixelIcon.svelte"
  import ScrollPane from "../ScrollPane.svelte"

  type Props = {
    /** The group box, header and frame-rate rows, measured by the workspace layout */
    group?: HTMLElement
    header?: HTMLElement
    fpsRow?: HTMLElement
  }

  let { group = $bindable(), header = $bindable(), fpsRow = $bindable() }: Props = $props()

  const { converter, actions } = getApp()

  let track = $state<HTMLDivElement>()

  const disabled = $derived(!converter.video)

  /** Clicking the rail (but not a trim handle) seeks to that point. */
  const onRailClick = (event: MouseEvent) => {
    const target = event.target
    if (target instanceof HTMLInputElement && target.classList.contains("video-trimmer-export")) return
    if (!track || converter.duration <= 0) return
    const { left, width } = track.getBoundingClientRect()
    if (width <= 0) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - left) / width))
    void converter.scrubToTime(ratio * converter.duration)
  }
</script>

<!-- With no video loaded the range stays on screen, disabled -->
<section
  class="group timeline video-timeline"
  id="video-timeline"
  hidden={disabled}
  inert={disabled}
  aria-labelledby="video-timeline-heading"
  bind:this={group}
>
  <h2 class="group-title" id="video-timeline-heading">Video range</h2>
  <ScrollPane class="pane pane-x" id="range-pane" axes="x">
    <div class="range-fit">
      <div class="video-trimmer" role="group" aria-labelledby="video-timeline-heading">
        <div class="video-trimmer-header" bind:this={header}>
          <div class="video-timeline-transport">
            <button
              type="button"
              class={["btn video-timeline-play", converter.playing && "is-playing"]}
              {disabled}
              aria-keyshortcuts="Space"
              aria-label={converter.playing ? "Stop preview" : "Play preview"}
              onclick={actions.play}
            >
              <span class="video-timeline-play-icon video-timeline-play-icon--play" aria-hidden="true">
                <PixelIcon name="play" />
              </span>
              <span class="video-timeline-play-icon video-timeline-play-icon--stop" aria-hidden="true">
                <PixelIcon name="stop" />
              </span>
            </button>
            <button
              type="button"
              class="btn video-timeline-play video-timeline-reset"
              {disabled}
              aria-label="Back to range start"
              onclick={actions.rewind}
            >
              <PixelIcon name="rewind" />
            </button>
            <span class="kbd-hint">Space plays the range</span>
          </div>

          <div class="video-trimmer-frames">
            <div class="video-trimmer-frame-col">
              <span class="video-trimmer-frame-label">Start:</span>
              <output class="video-trimmer-frame-value field-readout" for="export-frame-start">
                {converter.range.start}
              </output>
            </div>
            <div class="video-trimmer-frame-col video-trimmer-frame-col--current">
              <span class="video-trimmer-frame-label" id="frame-current-label">Frame:</span>
              <output class="video-trimmer-frame-value field-readout" for="frame">{converter.currentFrame}</output>
            </div>
            <div class="video-trimmer-frame-col">
              <span class="video-trimmer-frame-label">End:</span>
              <output class="video-trimmer-frame-value field-readout" for="export-frame-end">
                {converter.range.end}
              </output>
            </div>
          </div>
        </div>

        <div
          class="video-trimmer-rail"
          role="group"
          aria-label="Video timeline; click to seek"
          onclickcapture={onRailClick}
        >
          <div class="video-trimmer-track" aria-hidden="true" bind:this={track}></div>
          <div
            class="video-trimmer-range-fill"
            aria-hidden="true"
            style:--range-start-ratio={converter.rangeStartRatio}
            style:--range-end-ratio={converter.rangeEndRatio}
          ></div>
          <div
            class="video-trimmer-playhead"
            aria-hidden="true"
            style:--playhead-ratio={converter.playheadRatio}
          ></div>
          <input
            type="range"
            class="video-trimmer-export video-trimmer-export--start"
            id="export-frame-start"
            step="1"
            aria-label="Export start frame"
            {@attach rangeBounds(0, converter.frameMax, converter.handleStart)}
            oninput={(event) => converter.setHandle("start", Number(event.currentTarget.value))}
          />
          <input
            type="range"
            class="video-trimmer-export video-trimmer-export--end"
            id="export-frame-end"
            step="1"
            aria-label="Export end frame"
            {@attach rangeBounds(0, converter.frameMax, converter.handleEnd)}
            oninput={(event) => converter.setHandle("end", Number(event.currentTarget.value))}
          />
          <input
            type="range"
            class="video-trimmer-scrub"
            id="frame"
            step="0.001"
            aria-labelledby="frame-current-label"
            {@attach rangeBounds(0, Math.max(0, converter.duration), converter.scrubTime)}
            oninput={(event) => converter.scrubToTime(Number(event.currentTarget.value))}
          />
        </div>

        <p class="range-summary">
          <span>{converter.rangeSummary}</span>
          <span class="range-hint">Drag the handles to trim. Click the bar to seek.</span>
        </p>
      </div>

      <div class="field field-fps" bind:this={fpsRow}>
        <label class="field-label" for="export-fps">Export frame rate:</label>
        <input
          type="range"
          class="trackbar"
          id="export-fps"
          min={MIN_EXPORT_FPS}
          max={MAX_EXPORT_FPS}
          step="1"
          value={converter.fpsInput}
          aria-describedby="export-fps-hint"
          oninput={(event) => converter.setFps(Number(event.currentTarget.value))}
        />
        <span class="unit-readout"><output class="field-readout" for="export-fps">{converter.fps}</output> fps</span>
        <p class="field-hint" id="export-fps-hint">Higher rates give smoother motion and a larger file.</p>
      </div>
    </div>
  </ScrollPane>
</section>
