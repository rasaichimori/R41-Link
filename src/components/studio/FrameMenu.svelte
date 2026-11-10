<script lang="ts">
  import { getApp } from "../../lib/context"

  const { studio } = getApp()

  const frameMenu = $derived(studio.context !== null && studio.context.index < studio.frames.length)

  const items = () =>
    studio.contextEl ? [...studio.contextEl.querySelectorAll<HTMLElement>("button[role^='menuitem']")] : []

  const onPointerMove = (event: PointerEvent) => {
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>("button[role^='menuitem']") : null
    if (item && document.activeElement !== item) item.focus()
  }

  const onKeydown = (event: KeyboardEvent) => {
    const buttons = items()
    const index = buttons.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => {
      event.preventDefault()
      buttons[(to + buttons.length) % buttons.length]?.focus()
    }
    if (event.key === "ArrowDown") move(index + 1)
    else if (event.key === "ArrowUp") move(index - 1)
    else if (event.key === "Home") move(0)
    else if (event.key === "End") move(buttons.length - 1)
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault()
      studio.closeContext(true)
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!studio.context) return
    if (event.target instanceof Node && studio.contextEl?.contains(event.target)) return
    studio.closeContext()
  }

  const choose = (action: string, disabled = false) => {
    if (disabled || !studio.context) return
    const slot = studio.context.index
    studio.closeContext(true)
    studio.perform(action, slot)
  }
</script>

<svelte:document onpointerdown={onPointerDown} />

{#if studio.context}
  <div
    class="menu-popup context-menu"
    role="menu"
    aria-label="Frames"
    tabindex="-1"
    style:left="{studio.context.x}px"
    style:top="{studio.context.y}px"
    bind:this={studio.contextEl}
    onpointermove={onPointerMove}
    onkeydown={onKeydown}
  >
    {#if frameMenu}
      <button type="button" role="menuitem" onclick={() => choose("cut")}><span>Cut</span><span class="menu-key">Ctrl+X</span></button>
      <button type="button" role="menuitem" onclick={() => choose("copy")}><span>Copy</span><span class="menu-key">Ctrl+C</span></button>
      <button type="button" role="menuitem" aria-disabled={studio.clipboardEmpty} onclick={() => choose("paste-before", studio.clipboardEmpty)}>
        <span>Paste before</span><span class="menu-key">Ctrl+Shift+V</span>
      </button>
      <button type="button" role="menuitem" aria-disabled={studio.clipboardEmpty} onclick={() => choose("paste-after", studio.clipboardEmpty)}>
        <span>Paste after</span><span class="menu-key">Ctrl+V</span>
      </button>
      <button type="button" role="menuitem" aria-disabled={studio.clipboardEmpty} onclick={() => choose("paste-replace", studio.clipboardEmpty)}>
        <span>Paste over selection</span>
      </button>
      <div class="menu-sep" role="separator"></div>
      <button type="button" role="menuitem" onclick={() => choose("duplicate")}><span>Duplicate</span><span class="menu-key">D</span></button>
      <button type="button" role="menuitem" onclick={() => choose("blank")}><span>Insert blank frame</span><span class="menu-key">N</span></button>
      <button type="button" role="menuitem" onclick={() => choose("delete")}><span>Delete</span><span class="menu-key">Del</span></button>
      <div class="menu-sep" role="separator"></div>
      <button type="button" role="menuitem" aria-disabled={studio.selStart === 0} onclick={() => choose("move-left", studio.selStart === 0)}>
        <span>Move left</span><span class="menu-key">&lt;</span>
      </button>
      <button type="button" role="menuitem" aria-disabled={studio.selEnd === studio.frames.length - 1} onclick={() => choose("move-right", studio.selEnd === studio.frames.length - 1)}>
        <span>Move right</span><span class="menu-key">&gt;</span>
      </button>
      <button type="button" role="menuitem" onclick={() => choose("select-all")}><span>Select all frames</span><span class="menu-key">Ctrl+A</span></button>
    {:else}
      <button type="button" role="menuitem" aria-disabled={studio.clipboardEmpty} onclick={() => choose("paste-here", studio.clipboardEmpty)}>
        <span>Paste here</span>
      </button>
      <button type="button" role="menuitem" onclick={() => choose("add-here")}><span>Add blank frames up to here</span></button>
    {/if}
  </div>
{/if}
