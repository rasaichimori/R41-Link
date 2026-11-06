<script lang="ts">
  import { onMount } from "svelte"
  import { getApp } from "../lib/context"
  import PixelIcon from "./PixelIcon.svelte"
  import Menu from "./menu/Menu.svelte"
  import MenuItem from "./menu/MenuItem.svelte"

  const { windows, actions } = getApp()

  let now = $state(new Date())

  onMount(() => {
    const timer = setInterval(() => (now = new Date()), 15_000)
    return () => clearInterval(timer)
  })
</script>

<div class="taskbar" bind:this={windows.taskbar}>
  <Menu
    id="start"
    label="Start"
    opensUp
    class="menu-start"
    triggerClass="start-button"
    popupClass="start-menu"
  >
    {#snippet trigger()}
      <PixelIcon name="start" />
      Start
    {/snippet}
    <div class="start-banner" aria-hidden="true">
      <span>R41 <b>Link</b></span>
    </div>
    <div class="start-items">
      <MenuItem onselect={actions.open}>Open media...</MenuItem>
      <div class="menu-sep" role="separator"></div>
      <MenuItem onselect={actions.how}>How it works...</MenuItem>
      <MenuItem onselect={actions.about}>About R41 Link</MenuItem>
    </div>
  </Menu>

  <div class="task-buttons">
    {#each windows.list as win (win.id)}
      <button
        type="button"
        class="task-button"
        aria-pressed={windows.activeId === win.id}
        onclick={() => windows.focusFromTaskbar(win)}
      >
        {win.label}
      </button>
    {/each}
  </div>

  <div class="tray">
    <PixelIcon name="signal" />
    <time datetime={now.toISOString()}>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
  </div>
</div>
