<script lang="ts">
  import { getApp } from "../../lib/context"

  const { studio } = getApp()

  type Cell = { x: number; y: number }
  let stroke: { value: number; last: Cell; pointerId: number } | null = null
  let keyCursor: Cell | null = null

  const clampCell = (cell: Cell): Cell => ({
    x: Math.min(25, Math.max(0, cell.x)),
    y: Math.min(26, Math.max(0, cell.y)),
  })

  const onPointerDown = (event: PointerEvent) => {
    const canvas = event.currentTarget as HTMLCanvasElement
    const cell = studio.cellAt(event, canvas)
    if (!cell || (event.button !== 0 && event.button !== 2)) return
    event.preventDefault()
    studio.stop()
    studio.pushHistory()
    const value = studio.strokeValue(cell, event.button)
    stroke = { value, last: cell, pointerId: event.pointerId }
    canvas.setPointerCapture(event.pointerId)
    studio.paintLine(cell, cell, value)
    studio.showCursor(cell)
    studio.erasing = value === 0
  }

  const onPointerMove = (event: PointerEvent) => {
    const canvas = event.currentTarget as HTMLCanvasElement
    const cell = studio.cellAt(event, canvas)
    keyCursor = null
    studio.showCursor(cell)
    if (!stroke) studio.updateCursorMode(cell)
    if (!stroke || event.pointerId !== stroke.pointerId) return
    const next = cell ?? clampCell(stroke.last)
    studio.paintLine(stroke.last, next, stroke.value)
    stroke.last = next
  }

  const endStroke = () => {
    if (!stroke) return
    stroke = null
    studio.tick += 1
    studio.save()
  }

  const onPointerLeave = () => {
    if (!stroke) studio.showCursor(keyCursor)
  }

  const onKeydown = (event: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      event.stopPropagation()
      const from = keyCursor ?? { x: 13, y: 13 }
      keyCursor = clampCell({ x: from.x + move[0], y: from.y + move[1] })
      studio.showCursor(keyCursor)
      studio.updateCursorMode(keyCursor)
      return
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      keyCursor ??= { x: 13, y: 13 }
      studio.stop()
      studio.pushHistory()
      studio.paintLine(keyCursor, keyCursor, studio.strokeValue(keyCursor))
      studio.showCursor(keyCursor)
      studio.updateCursorMode(keyCursor)
      studio.tick += 1
      studio.save()
    }
  }

  const onBlur = () => {
    keyCursor = null
    studio.showCursor(null)
  }
</script>

<div class="pasteboard">
  <div class={["stage", !studio.grid && "no-grid", studio.blocks && "show-blocks", studio.erasing && "is-eraser"]}>
    <canvas
      id="stage-canvas"
      width="26"
      height="27"
      tabindex="0"
      aria-label="Drawing stage, 26 by 27 pixels. Arrow keys move the cursor; Space or Enter paints with the current tool."
      {@attach studio.paint}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={endStroke}
      onpointercancel={endStroke}
      onpointerleave={onPointerLeave}
      oncontextmenu={(event) => event.preventDefault()}
      onkeydown={onKeydown}
      onblur={onBlur}
    ></canvas>
    <div class="stage-grid" aria-hidden="true"></div>
    <div class="stage-blocks" aria-hidden="true"></div>
    <div
      class="stage-cursor"
      aria-hidden="true"
      hidden={studio.cursor === null}
      style:left={studio.cursor ? `${(studio.cursor.x / 26) * 100}%` : undefined}
      style:top={studio.cursor ? `${(studio.cursor.y / 27) * 100}%` : undefined}
    ></div>
  </div>
</div>
