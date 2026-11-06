<script lang="ts">
  import type { Snippet } from "svelte"
  import { getApp } from "../../lib/context"

  type Props = {
    role?: "menuitem" | "menuitemcheckbox" | "menuitemradio"
    /** For checkbox and radio items */
    checked?: boolean
    disabled?: boolean
    shortcut?: string
    onselect: () => void
    children: Snippet
  }

  let { role = "menuitem", checked, disabled = false, shortcut, onselect, children }: Props = $props()

  const { menus } = getApp()

  const choose = () => {
    if (disabled) return
    menus.close(true)
    onselect()
  }
</script>

<button
  type="button"
  {role}
  aria-checked={checked === undefined ? undefined : checked}
  aria-disabled={disabled}
  onclick={choose}
>
  <span>{@render children()}</span>
  {#if shortcut}
    <span class="menu-key">{shortcut}</span>
  {/if}
</button>
