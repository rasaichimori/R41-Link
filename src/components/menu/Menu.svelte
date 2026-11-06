<script lang="ts">
  import type { Snippet } from "svelte"
  import type { Attachment } from "svelte/attachments"
  import type { ClassValue } from "svelte/elements"
  import { getApp } from "../../lib/context"

  type Props = {
    id: string
    label: string
    /** Alt+key opens it; menubar menus only */
    accessKey?: string
    /** Part of the menubar: hover and Left/Right move between these */
    bar?: boolean
    /** The popup opens above its trigger, so Up also opens it */
    opensUp?: boolean
    class?: ClassValue
    triggerClass?: ClassValue
    popupClass?: ClassValue
    trigger: Snippet
    children: Snippet
  }

  let {
    id,
    label,
    accessKey,
    bar = false,
    opensUp = false,
    class: className,
    triggerClass = "menubar-item",
    popupClass,
    trigger,
    children,
  }: Props = $props()

  const { menus } = getApp()

  const open = $derived(menus.openId === id)

  const register: Attachment<HTMLDivElement> = (root) => menus.register({ id, accessKey, bar, root })

  const onTriggerKeydown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || (event.key === "ArrowUp" && opensUp)) {
      event.preventDefault()
      menus.show(id, true)
    }
  }

  const onPopupPointerMove = (event: PointerEvent) => {
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>("button[role^='menuitem']") : null
    if (item && document.activeElement !== item) item.focus()
  }

  const onPopupKeydown = (event: KeyboardEvent) => {
    const items = menus.itemsOf(id)
    const index = items.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => {
      event.preventDefault()
      items[(to + items.length) % items.length]?.focus()
    }
    switch (event.key) {
      case "ArrowDown":
        return move(index + 1)
      case "ArrowUp":
        return move(index - 1)
      case "Home":
        return move(0)
      case "End":
        return move(items.length - 1)
      case "ArrowRight":
      case "ArrowLeft":
        if (menus.step(id, event.key === "ArrowRight" ? 1 : -1)) event.preventDefault()
        return
      case "Escape":
        event.preventDefault()
        menus.close(false)
        menus.focusTrigger(id)
        return
      case "Tab":
        menus.close(false)
        return
    }
  }
</script>

<div class={["menu", className]} {@attach register}>
  <button
    type="button"
    class={triggerClass}
    role={bar ? "menuitem" : undefined}
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={(event) => menus.toggle(id, event.detail === 0)}
    onkeydown={onTriggerKeydown}
    onpointerenter={() => menus.hover(id)}
  >
    {@render trigger()}
  </button>
  <div
    class={["menu-popup", popupClass]}
    role="menu"
    tabindex="-1"
    aria-label={label}
    hidden={!open}
    onpointermove={onPopupPointerMove}
    onkeydown={onPopupKeydown}
  >
    {@render children()}
  </div>
</div>
