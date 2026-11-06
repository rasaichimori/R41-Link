<script lang="ts">
  import type { Attachment } from "svelte/attachments"
  import { MediaQuery } from "svelte/reactivity"
  import { observeResize } from "../lib/attachments"
  import ScrollPane from "./ScrollPane.svelte"
  import ConsolePanel from "./panels/ConsolePanel.svelte"
  import ConversionPanel from "./panels/ConversionPanel.svelte"
  import DisplayPanel from "./panels/DisplayPanel.svelte"
  import ExportPanel from "./panels/ExportPanel.svelte"
  import SourcePanel from "./panels/SourcePanel.svelte"
  import TimelinePanel from "./panels/TimelinePanel.svelte"

  type Props = { id: string }

  let { id }: Props = $props()

  /** Workspace grid puts the display beside the side panels from this width */
  const sideBySide = new MediaQuery("min-width: 900px")

  let side = $state<HTMLElement>()
  let timeline = $state<HTMLElement>()
  let rangeHeader = $state<HTMLElement>()
  let rangeFps = $state<HTMLElement>()
  let consoleCollapsed = $state(false)

  /*
   * When the video range is wider than the column beside the console, it takes
   * that whole bottom row and the console is removed. Widening the window puts
   * the console back. A still-narrow range scrolls inside its own pane.
   */
  const layout: Attachment<HTMLElement> = (workspace) => {
    if (!sideBySide.current) {
      consoleCollapsed = false
      return
    }
    const header = rangeHeader
    const fps = rangeFps
    const group = timeline
    const column = side
    if (!header || !fps || !group || !column) return

    const measure = () => {
      const styles = getComputedStyle(workspace)
      const groupStyles = getComputedStyle(group)
      const inner = workspace.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
      const gap = parseFloat(styles.columnGap) || 0
      const beside =
        inner - column.offsetWidth - gap - parseFloat(groupStyles.paddingLeft) - parseFloat(groupStyles.paddingRight)
      const need = Math.max(header.offsetWidth, fps.offsetWidth)
      consoleCollapsed = need > beside + 1
    }
    measure()
    void document.fonts?.ready.then(measure)
    return observeResize(measure, workspace, header, fps)
  }
</script>

<ScrollPane class={["window-body workspace", consoleCollapsed && "is-console-collapsed"]} {id} {@attach layout}>
  <DisplayPanel />

  <div class="col-side" bind:this={side}>
    <SourcePanel />
    <ConversionPanel />
    <ExportPanel />
  </div>

  <TimelinePanel bind:group={timeline} bind:header={rangeHeader} bind:fpsRow={rangeFps} />

  <ConsolePanel />
</ScrollPane>
