<script lang="ts">
  import { getApp } from "../lib/context"
  import PixelIcon from "./PixelIcon.svelte"
  import ScrollPane from "./ScrollPane.svelte"
  import Window from "./Window.svelte"

  const { windows } = getApp()

  const win = windows.get("studio-window")
</script>

<Window {win} titleId="studio-title" role="region" aria-labelledby="studio-title">
  {#snippet icon()}
    <PixelIcon name="studio" class="title-icon" />
  {/snippet}

  {#snippet heading()}Animation Studio{/snippet}

  <ScrollPane class="window-body studio-body" id="studio-window-body"></ScrollPane>
</Window>
