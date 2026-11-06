<script lang="ts">
  import { flushSync, type Snippet } from "svelte"
  import type { ClassValue } from "svelte/elements"
  import PixelIcon from "../PixelIcon.svelte"

  type Props = {
    id: string
    title: string
    class?: ClassValue
    /** Shows a close button in the title bar */
    closable?: boolean
    /** True while the dialog is showing; the body only renders then */
    open?: boolean
    onclose?: () => void
    children: Snippet
  }

  let { id, title, class: className, closable = false, open = $bindable(false), onclose, children }: Props =
    $props()

  let dialog: HTMLDialogElement

  /** Open as a modal and move focus to `focusSelector` inside it, else the default control. */
  export const show = (focusSelector = "[data-autofocus]") => {
    open = true
    flushSync()
    dialog.showModal()
    dialog.querySelector<HTMLElement>(focusSelector)?.focus()
  }

  export const isOpen = () => dialog.open

  const onClose = () => {
    open = false
    onclose?.()
  }
</script>

<dialog bind:this={dialog} class={["window dialog is-active", className]} {id} aria-labelledby="{id}-title" onclose={onClose}>
  <header class="title-bar">
    <h2 class="title-text" id="{id}-title">{title}</h2>
    {#if closable}
      <div class="title-controls">
        <form method="dialog">
          <button class="title-btn title-btn-close" aria-label="Close">
            <PixelIcon name="close" />
          </button>
        </form>
      </div>
    {/if}
  </header>
  {#if open}
    {@render children()}
  {/if}
</dialog>
