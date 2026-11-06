<script lang="ts">
  import type { Attachment } from "svelte/attachments"
  import { observeResize } from "../lib/attachments"

  type Props = {
    axis: "x" | "y"
    /** id of the scrolled element */
    controls: string
    size: number
    client: number
    pos: number
    scrollTo: (value: number) => void
  }

  let { axis, controls, size, client, pos, scrollTo }: Props = $props()

  const STEP = 48
  const LABELS = {
    y: { dec: "Scroll up", inc: "Scroll down" },
    x: { dec: "Scroll left", inc: "Scroll right" },
  }

  let trackSize = $state(0)
  let thumb = $state<HTMLDivElement>()

  const vertical = $derived(axis === "y")
  const overflow = $derived(Math.max(0, size - client))
  const thumbSize = $derived(overflow > 0 ? Math.max(16, Math.round((trackSize * client) / size)) : trackSize)
  const travel = $derived(Math.max(0, trackSize - thumbSize))
  const thumbPos = $derived(overflow > 0 && travel > 0 ? (pos / overflow) * travel : 0)

  const along = (event: PointerEvent) => (vertical ? event.clientY : event.clientX)

  const measureTrack: Attachment<HTMLDivElement> = (track) => {
    const measure = () => (trackSize = vertical ? track.clientHeight : track.clientWidth)
    measure()
    return observeResize(measure, track)
  }

  /** Arrow buttons step once, then repeat while held. */
  const hold = (dir: number, event: PointerEvent) => {
    event.preventDefault()
    const button = event.currentTarget as HTMLElement
    const step = () => scrollTo(pos + dir * STEP)
    step()
    try {
      button.setPointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
    let pulse: ReturnType<typeof setInterval> | undefined
    const wait = setTimeout(() => (pulse = setInterval(step, 50)), 280)
    const stop = () => {
      clearTimeout(wait)
      clearInterval(pulse)
    }
    button.addEventListener("pointerup", stop, { once: true })
    button.addEventListener("pointercancel", stop, { once: true })
  }

  // Keyboard activation and .click() report detail 0. A real mouse click follows pointerdown, so it is ignored here.
  const keyStep = (dir: number, event: MouseEvent) => {
    if (event.detail === 0) scrollTo(pos + dir * STEP)
  }

  const pageTo = (event: PointerEvent) => {
    const track = event.currentTarget as HTMLElement
    if (event.target !== track || !thumb) return
    const rect = track.getBoundingClientRect()
    const offset = vertical ? event.clientY - rect.top : event.clientX - rect.left
    const thumbStart = vertical ? thumb.offsetTop : thumb.offsetLeft
    const dir = offset < thumbStart ? -1 : 1
    scrollTo(pos + dir * client * 0.9)
  }

  const dragThumb = (event: PointerEvent) => {
    if (event.button !== 0 || !thumb) return
    event.preventDefault()
    const handle = thumb
    const start = pos
    const origin = along(event)
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
    const move = (next: PointerEvent) => {
      if (travel <= 0) return
      scrollTo(start + ((along(next) - origin) / travel) * overflow)
    }
    const stop = () => handle.removeEventListener("pointermove", move)
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", stop, { once: true })
    handle.addEventListener("pointercancel", stop, { once: true })
  }
</script>

<div
  class={vertical ? "vscroll" : "hscroll"}
  role="scrollbar"
  aria-orientation={vertical ? "vertical" : "horizontal"}
  aria-controls={controls}
  aria-valuemin={0}
  aria-valuemax={overflow}
  aria-valuenow={Math.round(pos)}
>
  <button
    type="button"
    class="scroll-btn"
    data-dir="-1"
    aria-label={LABELS[axis].dec}
    onpointerdown={(event) => hold(-1, event)}
    onclick={(event) => keyStep(-1, event)}
  ></button>
  <div class="scroll-track" role="presentation" onpointerdown={pageTo} {@attach measureTrack}>
    <div
      class="scroll-thumb"
      role="presentation"
      bind:this={thumb}
      style:height={vertical ? `${thumbSize}px` : undefined}
      style:top={vertical ? `${thumbPos}px` : undefined}
      style:width={vertical ? undefined : `${thumbSize}px`}
      style:left={vertical ? undefined : `${thumbPos}px`}
      onpointerdown={dragThumb}
    ></div>
  </div>
  <button
    type="button"
    class="scroll-btn"
    data-dir="1"
    aria-label={LABELS[axis].inc}
    onpointerdown={(event) => hold(1, event)}
    onclick={(event) => keyStep(1, event)}
  ></button>
  {#if !vertical}
    <div class="scroll-corner" aria-hidden="true"></div>
  {/if}
</div>
