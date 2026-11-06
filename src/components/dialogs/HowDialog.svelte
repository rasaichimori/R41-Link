<script lang="ts">
  import type { Attachment } from "svelte/attachments"
  import { EMPTY_GRID, GRID_H, GRID_W } from "../../lib/constants"
  import { getApp } from "../../lib/context"
  import { patternFromBlock } from "../../lib/midi"
  import { blockAtPoint, clampBlock, drawNoteMap, noteOfBlock, type Block } from "../../lib/noteMap"
  import Dialog from "./Dialog.svelte"

  const { converter } = getApp()

  const MAP_CELL = 24
  const BITS = [1, 2, 4, 8, 16, 32]
  const MOVES: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }

  let dialog: Dialog
  let selected = $state<Block>({ col: 6, row: 4 })
  let hovered = $state<Block | null>(null)
  let showNumbers = $state(false)

  const grid = $derived(converter.grid ?? EMPTY_GRID)
  const block = $derived(hovered ?? selected)
  const pattern = $derived(patternFromBlock(grid, block.col, block.row))
  const sum = $derived(
    pattern
      ? `${BITS.filter((bit) => pattern & bit).join(" + ")} = ${pattern}`
      : "No lit pixels, so this block sends no note.",
  )

  export const show = () => dialog.show()
  export const isOpen = () => dialog.isOpen()

  const paintMap: Attachment<HTMLCanvasElement> = (canvas) => {
    drawNoteMap(canvas, grid, { selected, hovered, showNumbers })
  }

  const onPointerMove = (event: PointerEvent & { currentTarget: HTMLCanvasElement }) => {
    hovered = blockAtPoint(event.currentTarget, event.clientX, event.clientY)
  }

  const onClick = (event: MouseEvent & { currentTarget: HTMLCanvasElement }) => {
    const hit = blockAtPoint(event.currentTarget, event.clientX, event.clientY)
    if (hit) selected = hit
  }

  const onKeydown = (event: KeyboardEvent) => {
    const move = MOVES[event.key]
    if (!move) return
    event.preventDefault()
    selected = clampBlock({ col: selected.col + move[0], row: selected.row + move[1] })
    hovered = null
  }
</script>

<Dialog bind:this={dialog} id="how-dialog" title="How it works" class="dialog-how" closable onclose={() => (hovered = null)}>
  <div class="dialog-body how-body">
    <section class="group how-map" aria-labelledby="how-map-title">
      <h3 class="group-title" id="how-map-title">Note map</h3>
      <canvas
        id="how-canvas"
        width={GRID_W * MAP_CELL}
        height={GRID_H * MAP_CELL}
        tabindex="0"
        aria-label="Note map of the current display. Use the arrow keys to select a block."
        aria-describedby="how-sum"
        data-autofocus
        onpointermove={onPointerMove}
        onpointerleave={() => (hovered = null)}
        onclick={onClick}
        onkeydown={onKeydown}
        {@attach paintMap}
      ></canvas>
      <label class="checkbox">
        <input type="checkbox" bind:checked={showNumbers} />
        <span>Show note numbers</span>
      </label>
    </section>

    <section class="group how-block" aria-labelledby="how-block-title">
      <h3 class="group-title" id="how-block-title">Selected block</h3>
      <div class="field-grid">
        <span class="field-label">Note:</span>
        <output class="field-readout">{noteOfBlock(block)}</output>
        <span class="field-label">Velocity:</span>
        <output class="field-readout">{pattern || "off"}</output>
      </div>
      <div class="how-bits" aria-hidden="true">
        {#each BITS as bit (bit)}
          <span class={{ on: pattern & bit }}>{bit}</span>
        {/each}
      </div>
      <p class="how-sum" id="how-sum">{sum}</p>
      <p class="field-hint">Point at a block to inspect it. Click or tap to keep it selected.</p>
    </section>

    <div class="how-text">
      <p>
        The display is 26×27 pixels, split into 117 blocks of 2×3. Each block is one MIDI note: 127 in the top-left
        corner, counting down row by row to 11 in the bottom-right.
      </p>
      <p>
        Each pixel in a block has a value. A block’s velocity is the sum of its lit pixels, from 1 to 63. Empty blocks
        send no note.
      </p>
      <p>
        A video exports one chord per frame across the range you choose, at your export frame rate. Tempo is written
        into the file and used to time each frame.
      </p>
    </div>

    <form method="dialog" class="dialog-actions"><button class="btn btn-default">OK</button></form>
  </div>
</Dialog>
