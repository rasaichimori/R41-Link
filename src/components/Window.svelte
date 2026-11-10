<script lang="ts">
  import type { Snippet } from "svelte"
  import type { HTMLAttributes } from "svelte/elements"
  import { getApp } from "../lib/context"
  import { RESIZE_EDGES, type DesktopWindow, type ResizeEdge } from "../lib/windows.svelte"
  import PixelIcon from "./PixelIcon.svelte"

  type Props = HTMLAttributes<HTMLDivElement> & {
    win: DesktopWindow
    titleTag?: "h1" | "h2"
    titleId?: string
    icon: Snippet
    heading: Snippet
    /** Shows a help button in the title bar */
    onhelp?: () => void
    helpLabel?: string
    menubar?: Snippet
    /** Rendered after the body; receives the pointer-down handler for a resize grip */
    statusbar?: Snippet<[(event: PointerEvent) => void]>
    children: Snippet
  }

  let {
    win,
    titleTag = "h2",
    titleId,
    icon,
    heading,
    onhelp,
    helpLabel = "How it works",
    menubar,
    statusbar,
    children,
    ...rest
  }: Props = $props()

  const { windows } = getApp()

  const px = (value: number | null) => (value === null ? undefined : `${value}px`)

  const onTitlePointerDown = (event: PointerEvent) => {
    // Activate first: moving the window in the DOM must happen before the pointer is captured
    windows.activate(win)
    if (!windows.canInteract(win, event)) return
    if ((event.target as Element).closest(".title-controls, .resize-handle")) return
    windows.startDrag(win, event.currentTarget as HTMLElement, event)
  }

  const onTitleDoubleClick = (event: MouseEvent) => {
    if ((event.target as Element).closest(".title-controls")) return
    windows.toggleMaximize(win)
  }

  const onEdgePointerDown = (edge: ResizeEdge) => (event: PointerEvent) => windows.beginResize(win, edge, event)
</script>

<div
  {...rest}
  bind:this={win.el}
  id={win.id}
  class={[
    "window",
    windows.activeId === win.id && "is-active",
    win.maximized && "is-maximized",
    win.minimized && "is-minimized",
  ]}
  style:--win-x="{win.x}px"
  style:--win-y="{win.y}px"
  style:--win-w={win.width}
  style:--win-h={px(win.keptHeight)}
  style:height={px(win.height)}
  style:max-width={px(win.maxWidth)}
  style:max-height={px(win.maxHeight)}
  onpointerdown={() => windows.activate(win)}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header class="title-bar" onpointerdown={onTitlePointerDown} ondblclick={onTitleDoubleClick}>
    {@render icon()}
    <svelte:element this={titleTag} class="title-text" id={titleId}>{@render heading()}</svelte:element>
    <div class="title-controls">
      {#if onhelp}
        <button type="button" class="title-btn" aria-label={helpLabel} onclick={onhelp}>
          <PixelIcon name="help" />
        </button>
      {/if}
      <button type="button" class="title-btn" aria-label="Minimize" onclick={() => windows.minimize(win)}>
        <PixelIcon name="minimize" />
      </button>
      <button
        type="button"
        class="title-btn"
        aria-label={win.maximized ? "Restore" : "Maximize"}
        aria-pressed={win.maximized}
        onclick={() => windows.toggleMaximize(win)}
      >
        <PixelIcon name="maximize" />
      </button>
      <span class="title-btn title-btn-close is-disabled" aria-hidden="true">
        <PixelIcon name="close" hidden={false} />
      </span>
    </div>
  </header>

  {@render menubar?.()}
  {@render children()}
  {@render statusbar?.(onEdgePointerDown("se"))}

  <!-- Edge and corner grabs come last so they receive the pointer without a z-index -->
  {#each RESIZE_EDGES as edge (edge)}
    <div
      class="resize-handle resize-{edge}"
      role="presentation"
      aria-label={edge === "se" ? "Resize" : undefined}
      aria-hidden={edge === "se" ? undefined : "true"}
      onpointerdown={onEdgePointerDown(edge)}
    ></div>
  {/each}
</div>
