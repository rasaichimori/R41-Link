<script lang="ts">
  import { onMount } from "svelte"
  import { on } from "svelte/events"
  import ConverterWindow from "./components/ConverterWindow.svelte"
  import FrameMenu from "./components/studio/FrameMenu.svelte"
  import StudioWindow from "./components/StudioWindow.svelte"
  import Taskbar from "./components/Taskbar.svelte"
  import AboutDialog from "./components/dialogs/AboutDialog.svelte"
  import HowDialog from "./components/dialogs/HowDialog.svelte"
  import KeysDialog from "./components/dialogs/KeysDialog.svelte"
  import StudioAboutDialog from "./components/dialogs/StudioAboutDialog.svelte"
  import { ConsoleLog } from "./lib/consoleLog.svelte"
  import { setApp, type AppActions } from "./lib/context"
  import { Converter } from "./lib/converter.svelte"
  import { hasFiles, openFilePicker } from "./lib/files"
  import { MenuController } from "./lib/menus.svelte"
  import { SchemeSetting } from "./lib/scheme.svelte"
  import { Studio } from "./lib/studio.svelte"
  import { DesktopWindow, WindowManager } from "./lib/windows.svelte"

  const log = new ConsoleLog()
  const converter = new Converter(log)
  const menus = new MenuController()
  const scheme = new SchemeSetting()
  const studio = new Studio(scheme)
  const windows = new WindowManager([
    new DesktopWindow("app-window", "MIDI Converter", 16, 16, "min(1080px, calc(100% - 32px))"),
    new DesktopWindow("studio-window", "Animation Studio", 48, 36, "min(1080px, calc(100% - 32px))"),
  ])

  let howDialog: HowDialog
  let aboutDialog: AboutDialog
  let keysDialog: KeysDialog
  let studioAbout: StudioAboutDialog

  const actions: AppActions = {
    open: () => openFilePicker(converter.pickFiles),
    exportMidi: () => {
      if (converter.exportDisabled) return
      log.command("export --midi")
      void converter.exportMidi()
    },
    play: () => {
      if (!converter.video) return
      log.command(converter.playing ? "stop" : "play")
      void converter.togglePlayback()
    },
    rewind: () => {
      if (!converter.video) return
      log.command("rewind")
      void converter.resetToStart()
    },
    setInvert: (on) => {
      converter.setInvert(on)
      log.command(`invert ${on ? "on" : "off"}`)
    },
    how: () => howDialog.show(),
    about: () => aboutDialog.show(),
  }

  setApp({ converter, log, windows, menus, scheme, studio, actions })

  const documentTitle = $derived(converter.fileName ? `${converter.fileName} - MIDI Converter` : "MIDI Converter")

  /* Drop a file anywhere on the page */
  let dragDepth = 0
  let fileDragging = $state(false)

  const endDrag = () => {
    dragDepth = 0
    fileDragging = false
  }

  const onDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return
    dragDepth += 1
    fileDragging = true
  }

  const onDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) endDrag()
  }

  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event) || !event.dataTransfer) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  const onDrop = (event: DragEvent) => {
    endDrag()
    if (!hasFiles(event)) return
    event.preventDefault()
    converter.pickFiles(event.dataTransfer?.files)
  }

  const dialogOpen = () => howDialog?.isOpen() || aboutDialog?.isOpen() || studio.keysOpen || studio.aboutOpen

  const activeWindow = () => windows.list.find((win) => win.id === windows.activeId)?.el ?? null

  /** Space plays the range unless the focused control uses Space itself. */
  const spaceIsFree = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return true
    if (target.isContentEditable || target.closest("button, summary, select, textarea, canvas, [role='button']")) {
      return false
    }
    return !(target instanceof HTMLInputElement && target.type !== "range")
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (dialogOpen()) return

    const studioActive = windows.activeId === "studio-window"

    // Alt+letter opens the menubar of the window in front
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      if (menus.openByKey(event.key, activeWindow())) event.preventDefault()
      return
    }

    if (event.key === "Escape" && menus.openId) {
      menus.close(true)
      return
    }

    if (studioActive) return

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
      event.preventDefault()
      actions.open()
      return
    }

    if (event.code !== "Space" || event.repeat || event.ctrlKey || event.metaKey || menus.openId) return
    if (!spaceIsFree(event.target) || !converter.video) return
    event.preventDefault()
    actions.play()
  }

  const onPointerDown = (event: PointerEvent) => {
    if (menus.openId && !menus.contains(event.target)) menus.close()
  }

  /* Trackpad / mouse wheel over sliders should not scroll the page */
  const onWheel = (event: WheelEvent) => {
    const target = event.target
    if (target instanceof HTMLInputElement && target.type === "range") event.preventDefault()
  }

  onMount(() => {
    studio.showKeys = () => keysDialog.show()
    studio.showAbout = () => studioAbout.show()
    windows.fitAll()
    const stopListening = windows.listen()
    const stopWheel = on(document, "wheel", onWheel, { passive: false })
    return () => {
      stopListening()
      stopWheel()
    }
  })
</script>

<svelte:head>
  <title>{documentTitle}</title>
</svelte:head>

<svelte:window onresize={windows.fitAll} />

<svelte:document
  onkeydown={onKeydown}
  onpointerdown={onPointerDown}
  ondragenter={onDragEnter}
  ondragleave={onDragLeave}
  ondragover={onDragOver}
  ondrop={onDrop}
/>

<div
  class={["desktop", fileDragging && "is-file-dragging"]}
  data-media={converter.fileName ? "loaded" : "none"}
  bind:this={windows.desktop}
>
  {#each windows.order as id (id)}
    {#if id === "app-window"}
      <ConverterWindow />
    {:else}
      <StudioWindow />
    {/if}
  {/each}
</div>

<Taskbar />

<FrameMenu />

<HowDialog bind:this={howDialog} />
<AboutDialog bind:this={aboutDialog} />
<KeysDialog bind:this={keysDialog} bind:open={studio.keysOpen} />
<StudioAboutDialog bind:this={studioAbout} bind:open={studio.aboutOpen} />
