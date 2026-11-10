<script lang="ts">
  import { getApp } from "../lib/context"
  import PixelIcon from "./PixelIcon.svelte"
  import Window from "./Window.svelte"
  import PropertiesPanel from "./studio/PropertiesPanel.svelte"
  import StageCanvas from "./studio/StageCanvas.svelte"
  import StudioMenus from "./studio/StudioMenus.svelte"
  import StudioToolbar from "./studio/StudioToolbar.svelte"
  import TimelinePanel from "./studio/TimelinePanel.svelte"
  import ToolsPanel from "./studio/ToolsPanel.svelte"

  const { windows, studio, menus } = getApp()
  const win = windows.get("studio-window")

  const onKeydown = (event: KeyboardEvent) => {
    if (windows.activeId !== win.id) return
    if (menus.openId || studio.keysOpen || studio.aboutOpen) return
    studio.onKeydown(event)
  }
</script>

<svelte:document onkeydown={onKeydown} />

<Window
  {win}
  titleTag="h1"
  titleId="studio-title"
  helpLabel="Keyboard shortcuts"
  onhelp={() => studio.perform("keys")}
>
  {#snippet icon()}
    <PixelIcon name="studio" class="title-icon" />
  {/snippet}

  {#snippet heading()}Animation Studio - <span>Untitled</span>{/snippet}

  {#snippet menubar()}
    <StudioMenus />
  {/snippet}

  <StudioToolbar />

  <div class="window-body studio">
    <TimelinePanel />
    <ToolsPanel />
    <StageCanvas />
    <PropertiesPanel />
  </div>

  {#snippet statusbar(onResize)}
    <footer class="status-bar">
      <p class="status-field status-main">{studio.statusText}</p>
      <p class="status-field status-pos">{studio.positionText}</p>
      <p class="status-field">{studio.frameReadout}</p>
      <span class="resize-grip" aria-hidden="true" onpointerdown={onResize}></span>
    </footer>
  {/snippet}
</Window>
