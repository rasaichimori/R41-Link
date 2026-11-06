<script lang="ts">
  import type { Snippet } from "svelte"
  import type { Attachment } from "svelte/attachments"
  import type { HTMLAttributes } from "svelte/elements"
  import ScrollBar from "./ScrollBar.svelte"

  type Props = HTMLAttributes<HTMLDivElement> & {
    id: string
    /** Which painted scrollbars to show */
    axes?: "both" | "x" | "y"
    children?: Snippet
  }

  let { id, axes = "both", children, ...rest }: Props = $props()

  /*
   * Real scrollbars, because the system ones are overlays that disappear. The
   * scroller keeps its own scroll; the bars are siblings that drive it.
   */
  let scroller: HTMLDivElement | undefined
  let metrics = $state({ top: 0, left: 0, height: 0, width: 0, clientHeight: 0, clientWidth: 0 })

  const scrollY = $derived(axes !== "x" && metrics.height - metrics.clientHeight > 1)
  const scrollX = $derived(axes !== "y" && metrics.width - metrics.clientWidth > 1)

  const sync = () => {
    if (!scroller) return
    metrics = {
      top: scroller.scrollTop,
      left: scroller.scrollLeft,
      height: scroller.scrollHeight,
      width: scroller.scrollWidth,
      clientHeight: scroller.clientHeight,
      clientWidth: scroller.clientWidth,
    }
  }

  const track: Attachment<HTMLDivElement> = (element) => {
    scroller = element
    const resize = new ResizeObserver(sync)
    resize.observe(element)
    for (const child of element.children) resize.observe(child)
    const mutation = new MutationObserver(sync)
    mutation.observe(element, { childList: true, subtree: true, attributes: true, characterData: true })
    sync()
    return () => {
      resize.disconnect()
      mutation.disconnect()
      scroller = undefined
    }
  }

  const scrollTopTo = (value: number) => scroller && (scroller.scrollTop = value)
  const scrollLeftTo = (value: number) => scroller && (scroller.scrollLeft = value)
</script>

<div class={["body-row", scrollY && "is-scroll-y", scrollX && "is-scroll-x"]}>
  <div class="body-main">
    <div {...rest} {id} onscroll={sync} {@attach track}>
      {@render children?.()}
    </div>
    {#if axes !== "x"}
      <ScrollBar
        axis="y"
        controls={id}
        size={metrics.height}
        client={metrics.clientHeight}
        pos={metrics.top}
        scrollTo={scrollTopTo}
      />
    {/if}
  </div>
  {#if axes !== "y"}
    <ScrollBar
      axis="x"
      controls={id}
      size={metrics.width}
      client={metrics.clientWidth}
      pos={metrics.left}
      scrollTo={scrollLeftTo}
    />
  {/if}
</div>
