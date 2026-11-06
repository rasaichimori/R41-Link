<script lang="ts">
  import type { Attachment } from "svelte/attachments"
  import { EMPTY_GRID, GRID_H, GRID_W } from "../../lib/constants"
  import { getApp } from "../../lib/context"
  import { drawDropOverlay } from "../../lib/glyphs"
  import { drawGrid } from "../../lib/preview"
  import ScrollPane from "../ScrollPane.svelte"

  const { converter } = getApp()

  const paintPreview: Attachment<HTMLCanvasElement> = (canvas) => {
    drawGrid(canvas, converter.grid ?? EMPTY_GRID, converter.scale)
  }

  /* Zoom resizes the canvas box; keep the page from jumping when already scrolled. */
  let zoomScrollLock: number | null = null

  const lockScrollForZoom = () => {
    if (zoomScrollLock === null) zoomScrollLock = window.scrollY
  }

  const restoreScrollAfterZoom = () => {
    if (zoomScrollLock === null) return
    const y = zoomScrollLock
    window.scrollTo(0, y)
    requestAnimationFrame(() => window.scrollTo(0, y))
  }

  const onZoomKeydown = (event: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) lockScrollForZoom()
  }

  const onZoomInput = (event: Event & { currentTarget: HTMLInputElement }) => {
    converter.scale = Number(event.currentTarget.value)
    restoreScrollAfterZoom()
  }

  const onZoomPointerUp = () => {
    restoreScrollAfterZoom()
    zoomScrollLock = null
  }
</script>

<section class="group stage" aria-labelledby="preview-heading">
  <h2 class="group-title" id="preview-heading">Display</h2>
  <ScrollPane class="pane" id="display-pane">
    <div class="lcd-bay">
      <div class="lcd">
        <canvas id="preview" aria-label="26 by 27 pixel preview" {@attach paintPreview}></canvas>
        <canvas class="lcd-overlay" width={GRID_W} height={GRID_H} aria-hidden="true" {@attach drawDropOverlay}
        ></canvas>
      </div>
    </div>
    <label class="tool-zoom">
      <span>Zoom:</span>
      <input
        type="range"
        class="trackbar preview-scale-input"
        min="4"
        max="24"
        value={converter.scale}
        aria-label="Preview zoom"
        aria-valuetext="{converter.scale}×"
        oninput={onZoomInput}
        onpointerdowncapture={lockScrollForZoom}
        onfocuscapture={lockScrollForZoom}
        onkeydowncapture={onZoomKeydown}
        onpointerup={onZoomPointerUp}
        onblur={() => (zoomScrollLock = null)}
      />
    </label>
  </ScrollPane>
</section>
