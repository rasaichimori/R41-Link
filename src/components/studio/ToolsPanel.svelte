<script lang="ts">
  import { getApp } from "../../lib/context"
  import type { StudioTool } from "../../lib/studio.svelte"
  import StudioIcon from "./StudioIcon.svelte"
  import type { StudioIconName } from "../../lib/studioIcons"

  const { studio } = getApp()

  const tools: { tool: StudioTool; icon: StudioIconName; label: string; title: string }[] = [
    { tool: "pencil", icon: "pencil", label: "Pencil", title: "Pencil (P)" },
    { tool: "eraser", icon: "eraser", label: "Eraser", title: "Eraser (E, or right-click)" },
    {
      tool: "auto",
      icon: "auto",
      label: "Auto: erases if you start on a lit pixel, draws otherwise",
      title: "Auto (A): start on a lit pixel to erase, anywhere else to draw",
    },
  ]
</script>

<section class="group tools-panel" aria-labelledby="tools-title">
  <h2 class="group-title" id="tools-title">Tools</h2>
  <div class="tool-grid" role="radiogroup" aria-label="Drawing tool">
    {#each tools as tool (tool.tool)}
      <button
        type="button"
        class="tool-btn"
        role="radio"
        aria-checked={studio.tool === tool.tool}
        aria-label={tool.label}
        title={tool.title}
        onclick={() => studio.setTool(tool.tool)}
      >
        <StudioIcon name={tool.icon} class="icon-lg" />
      </button>
    {/each}
  </div>
  <p class="tool-caption">Options</p>
  <div class="tool-grid">
    <button type="button" class="tool-btn" aria-label="Clear frame" title="Clear frame" onclick={() => studio.perform("clear")}>
      <StudioIcon name="clear" class="icon-lg" />
    </button>
    <button type="button" class="tool-btn" aria-label="Invert frame" title="Invert frame" onclick={() => studio.perform("invert")}>
      <StudioIcon name="invert" class="icon-lg" />
    </button>
  </div>
</section>
