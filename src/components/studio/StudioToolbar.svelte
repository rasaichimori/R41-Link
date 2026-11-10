<script lang="ts">
  import { getApp } from "../../lib/context"
  import StudioIcon from "./StudioIcon.svelte"
  import type { StudioIconName } from "../../lib/studioIcons"

  const { studio } = getApp()

  type ToolButton = {
    action: string
    icon: StudioIconName
    label?: string
    title: string
    iconOnly?: boolean
    class?: string
    disabled?: boolean
  }

  const groups = $derived<ToolButton[][]>([
    [
      { action: "blank", icon: "blank", label: "New", title: "New blank frame (N)" },
      { action: "duplicate", icon: "duplicate", label: "Duplicate", title: "Duplicate frames (D)" },
      { action: "delete", icon: "delete", label: "Delete", title: "Delete frames (Del)" },
    ],
    [
      { action: "cut", icon: "cut", title: "Cut frames (Ctrl+X)", iconOnly: true, class: "tb-cut" },
      { action: "copy", icon: "copy", title: "Copy frames (Ctrl+C)", iconOnly: true },
      {
        action: "paste-after",
        icon: "paste",
        title: "Paste after the selection (Ctrl+V)",
        iconOnly: true,
        disabled: studio.clipboardEmpty,
      },
    ],
    [
      { action: "first", icon: "first", title: "First frame (Home)", iconOnly: true, class: "tb-first", disabled: studio.current === 0 },
      {
        action: "prev",
        icon: "prev",
        title: "Previous frame (,)",
        iconOnly: true,
        disabled: studio.current === 0 && !studio.loop,
      },
      { action: "play", icon: "play", title: "", iconOnly: true },
      {
        action: "next",
        icon: "next",
        title: "Next frame (.)",
        iconOnly: true,
        disabled: studio.current === studio.frames.length - 1 && !studio.loop,
      },
      {
        action: "last",
        icon: "last",
        title: "Last frame (End)",
        iconOnly: true,
        class: "tb-last",
        disabled: studio.current === studio.frames.length - 1,
      },
      { action: "toggle-loop", icon: "loop", label: "Loop", title: "Loop playback" },
    ],
    [
      { action: "undo", icon: "undo", title: "Undo (Ctrl+Z)", iconOnly: true, disabled: !studio.canUndo },
      { action: "redo", icon: "redo", title: "Redo (Ctrl+Y)", iconOnly: true, disabled: !studio.canRedo },
    ],
  ])
</script>

<div class="toolbar" role="toolbar" aria-label="Frames and playback">
  {#each groups as group, groupIndex (groupIndex)}
    {#if groupIndex > 0}
      <span class="tb-sep" aria-hidden="true"></span>
    {/if}
    {#each group as button (button.action)}
      {#if button.action === "play"}
        <button
          type="button"
          id="play-btn"
          class={["tb-btn", "tb-icon", studio.playing && "is-playing"]}
          aria-label={studio.playing ? "Stop" : "Play"}
          title={studio.playing ? "Stop (Space)" : "Play (Space)"}
          onclick={() => studio.perform("play")}
        >
          <StudioIcon name="play" class="icon-play" />
          <StudioIcon name="stop" class="icon-stop" />
        </button>
      {:else if button.action === "toggle-loop"}
        <button
          type="button"
          id="loop-btn"
          class="tb-btn"
          aria-pressed={studio.loop}
          title={button.title}
          onclick={() => studio.perform("toggle-loop")}
        >
          <StudioIcon name="loop" />
          <span>Loop</span>
        </button>
      {:else}
        <button
          type="button"
          class={["tb-btn", button.iconOnly && "tb-icon", button.class]}
          aria-label={button.iconOnly ? button.title : undefined}
          title={button.title}
          disabled={button.disabled}
          onclick={() => studio.perform(button.action)}
        >
          <StudioIcon name={button.icon} />
          {#if button.label}
            <span>{button.label}</span>
          {/if}
        </button>
      {/if}
    {/each}
  {/each}
</div>
