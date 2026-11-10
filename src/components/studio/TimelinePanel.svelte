<script lang="ts">
  import { getApp } from "../../lib/context"
  import StudioIcon from "./StudioIcon.svelte"

  const { studio, menus } = getApp()

  type Gesture =
    | { type: "scrub"; id: number }
    | { type: "press" | "move"; id: number; x: number; index: number; gap: number }

  let gesture: Gesture | null = null

  const marks = $derived.by(() => {
    const list: number[] = []
    for (let n = 1; n <= studio.slots; n += 1) if (n === 1 || n % 5 === 0) list.push(n)
    return list
  })

  const onionSpan = $derived.by(() => {
    if (!studio.onion || studio.playing) return null
    const start = Math.max(0, studio.current - studio.onionCount)
    const end = studio.onionNext
      ? Math.min(studio.frames.length - 1, studio.current + studio.onionCount)
      : studio.current
    return { start, end }
  })

  const endGesture = () => {
    gesture = null
    studio.dropLeft = null
    studio.moving = false
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    studio.closeContext()
    const track = event.currentTarget as HTMLElement
    const index = studio.frameAt(event, track)
    if (index < 0) return
    if (index >= studio.frames.length) {
      studio.addFramesTo(index, event.shiftKey)
      return
    }
    track.setPointerCapture(event.pointerId)
    if (studio.onRuler(event, track)) {
      gesture = { type: "scrub", id: event.pointerId }
      studio.jump(index)
      return
    }
    studio.stop()
    if (event.shiftKey) {
      studio.extendTo(index)
      studio.refreshSelection()
      return
    }
    if (studio.isSelected(index)) studio.current = index
    else studio.selectOnly(index)
    studio.refreshSelection()
    gesture = { type: "press", id: event.pointerId, x: event.clientX, index, gap: -1 }
  }

  const onPointerMove = (event: PointerEvent) => {
    const track = event.currentTarget as HTMLElement
    if (!gesture) {
      studio.showAddHover(studio.frameAt(event, track))
      return
    }
    if (gesture.id !== event.pointerId) return
    if (gesture.type === "scrub") {
      const index = Math.min(studio.frames.length - 1, Math.max(0, studio.frameAt(event, track)))
      if (index !== studio.current) studio.jump(index)
      return
    }
    if (gesture.type === "press" && Math.abs(event.clientX - gesture.x) > 5) {
      gesture = { ...gesture, type: "move" }
      studio.moving = true
      studio.showAddHover(-1)
    }
    if (gesture.type !== "move") return

    const scroller = studio.tlScroll
    if (scroller) {
      const view = scroller.getBoundingClientRect()
      if (event.clientX < view.left + 24) scroller.scrollLeft -= studio.cell
      else if (event.clientX > view.right - 24) scroller.scrollLeft += studio.cell
    }
    const gap = studio.gapAt(event, track)
    const valid = !(gap >= studio.selStart && gap <= studio.selEnd + 1)
    gesture.gap = valid ? gap : -1
    studio.dropLeft = valid ? gap * studio.cell : null
    if (valid) {
      const count = studio.selCount
      const at = gap > studio.selEnd ? gap - count : gap
      studio.status = `Move ${studio.rangeLabel(studio.selStart, studio.selEnd)} to ${studio.rangeLabel(at, at + count - 1).replace(/^frames? /, "")}.`
    } else {
      studio.status = "Drop between other frames to move the selection."
    }
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!gesture || gesture.id !== event.pointerId) return
    const finished = gesture
    endGesture()
    if (finished.type === "move") {
      if (finished.gap < 0 || !studio.moveSelectionTo(finished.gap)) studio.status = ""
    } else if (finished.type === "press" && studio.selCount > 1) {
      studio.selectOnly(finished.index)
      studio.refreshSelection()
    }
  }

  const onPointerLeave = () => {
    if (!gesture) studio.showAddHover(-1)
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault()
      const cell = (event.currentTarget as HTMLElement).querySelectorAll(".tl-frame")[studio.current]
      const rect = cell?.getBoundingClientRect()
      if (rect) {
        menus.close()
        studio.openContext(rect.left + 4, rect.bottom, studio.current, true)
      }
      return
    }
    const map: Record<string, number> = {
      ArrowLeft: studio.current - 1,
      ArrowRight: studio.current + 1,
      ArrowDown: studio.current - 1,
      ArrowUp: studio.current + 1,
      Home: 0,
      End: studio.frames.length - 1,
    }
    if (!(event.key in map)) return
    event.preventDefault()
    event.stopPropagation()
    const index = Math.min(studio.frames.length - 1, Math.max(0, map[event.key]))
    if (event.shiftKey) {
      studio.stop()
      studio.extendTo(index)
      studio.refreshSelection()
    } else studio.jump(index)
  }

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    const index = studio.frameAt(event, event.currentTarget as HTMLElement)
    if (index < 0) return
    if (index < studio.frames.length && !studio.isSelected(index)) {
      studio.stop()
      studio.selectOnly(index)
      studio.refreshSelection()
    }
    menus.close()
    studio.openContext(event.clientX, event.clientY, index)
  }
</script>

<section class="group timeline-panel" aria-labelledby="timeline-title">
  <h2 class="group-title" id="timeline-title">Timeline</h2>
  <div class="tl">
    <div class="tl-layers">
      <div class="tl-layers-head" aria-hidden="true"></div>
      <div class="tl-layer">
        <StudioIcon name="layer" />
        <span class="tl-layer-name">Layer 1</span>
        <StudioIcon name="pencil-small" class="tl-layer-pencil" />
      </div>
    </div>
    <div
      class="tl-scroll"
      role="slider"
      tabindex="0"
      aria-label="Current frame. Shift with arrow keys selects; the context menu key opens frame options."
      aria-valuemin="1"
      aria-valuemax={studio.frames.length}
      aria-valuenow={studio.current + 1}
      aria-valuetext="Frame {studio.current + 1} of {studio.frames.length}"
      bind:this={studio.tlScroll}
      {@attach studio.watchTimeline}
      onkeydown={onKeydown}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class={["tl-track", studio.moving && "is-moving", studio.addHover >= 0 && "is-over-empty"]}
        style:width="{studio.slots * studio.cell}px"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={endGesture}
        onpointerleave={onPointerLeave}
        oncontextmenu={onContextMenu}
      >
        <div class="tl-ruler" aria-hidden="true">
          {#each marks as mark (mark)}
            <span style:left="{(mark - 1) * studio.cell}px">{mark}</span>
          {/each}
        </div>
        <div class="tl-cells" aria-hidden="true">
          {#each studio.frames as _, index (index)}
            <div
              class={[
                "tl-frame",
                (index + 1) % 5 === 0 && "is-fifth",
                studio.inkAt(index) && "has-ink",
                studio.isSelected(index) && "is-selected",
              ]}
              style:left="{index * studio.cell}px"
            ></div>
          {/each}
        </div>
        <div
          class="tl-add-range"
          aria-hidden="true"
          hidden={studio.addHover <= studio.frames.length}
          style:left="{studio.frames.length * studio.cell}px"
          style:width="{Math.max(0, studio.addHover - studio.frames.length) * studio.cell}px"
        ></div>
        <div
          class={["tl-add", studio.addHover >= 0 && "is-hover"]}
          aria-hidden="true"
          title="Add a frame (Shift+click adds a copy of the last frame)"
          style:left="{(studio.addHover >= 0 ? studio.addHover : studio.frames.length) * studio.cell}px"
        ></div>
        {#if onionSpan}
          <div
            class="tl-onion"
            aria-hidden="true"
            style:left="{onionSpan.start * studio.cell}px"
            style:width="{(onionSpan.end - onionSpan.start + 1) * studio.cell}px"
          ></div>
        {/if}
        <div class="tl-playhead" aria-hidden="true" style:left="{studio.current * studio.cell}px"></div>
        <div class="tl-drop" aria-hidden="true" hidden={studio.dropLeft === null} style:left="{studio.dropLeft ?? 0}px"></div>
      </div>
    </div>
  </div>
  <div class="tl-foot">
    <label class="checkbox">
      <input
        type="checkbox"
        id="onion-toggle"
        checked={studio.onion}
        onchange={(event) => studio.setOnion({ onion: event.currentTarget.checked })}
      />
      <span>Onion skin</span>
    </label>
    <label class="tl-onion-count">
      <span>Layers:</span>
      <input
        type="range"
        class="trackbar"
        id="onion-count"
        min="1"
        max="8"
        step="1"
        value={studio.onionCount}
        aria-label="Onion skin layers"
        oninput={(event) => studio.setOnion({ onionCount: Number(event.currentTarget.value) })}
      />
      <output class="field-readout" for="onion-count">{studio.onionCount}</output>
    </label>
    <label class="checkbox">
      <input
        type="checkbox"
        id="onion-next"
        checked={studio.onionNext}
        onchange={(event) => studio.setOnion({ onionNext: event.currentTarget.checked })}
      />
      <span>Show next frames</span>
    </label>
    <span class="tl-readouts" aria-live="off">
      <span class="status-field" title="Current frame">{studio.current + 1}</span>
      <span class="status-field" title="Frame rate">{studio.fps.toFixed(1)} fps</span>
      <span class="status-field" title="Time at current frame">{studio.timeReadout}</span>
    </span>
  </div>
</section>
