<script lang="ts">
  import { getApp } from "../lib/context"
  import type { Scheme } from "../lib/scheme.svelte"
  import PixelIcon from "./PixelIcon.svelte"
  import Window from "./Window.svelte"
  import Workspace from "./Workspace.svelte"
  import Menu from "./menu/Menu.svelte"
  import MenuItem from "./menu/MenuItem.svelte"

  const { converter, windows, scheme, actions } = getApp()

  const win = windows.get("app-window")

  const SCHEMES: { value: Scheme; label: string }[] = [
    { value: "auto", label: "Match system colors" },
    { value: "light", label: "Standard colors" },
    { value: "dark", label: "Night colors" },
  ]
</script>

<Window {win} titleTag="h1" onhelp={actions.how}>
  {#snippet icon()}
    <PixelIcon name="app" class="title-icon" />
  {/snippet}

  {#snippet heading()}
    MIDI Converter - <span>{converter.fileName ?? "Untitled"}</span>
  {/snippet}

  {#snippet menubar()}
    <div class="menubar" role="menubar" aria-label="MIDI Converter">
      <Menu id="file" label="File" accessKey="f" bar>
        {#snippet trigger()}<u>F</u>ile{/snippet}
        <MenuItem shortcut="Ctrl+O" onselect={actions.open}>Open media...</MenuItem>
        <div class="menu-sep" role="separator"></div>
        <MenuItem disabled={converter.exportDisabled} onselect={actions.exportMidi}>Export MIDI...</MenuItem>
      </Menu>

      <Menu id="view" label="View" accessKey="v" bar>
        {#snippet trigger()}<u>V</u>iew{/snippet}
        <MenuItem shortcut="Space" disabled={!converter.video} onselect={actions.play}>
          {converter.playing ? "Stop" : "Play range"}
        </MenuItem>
        <MenuItem disabled={!converter.video} onselect={actions.rewind}>Back to range start</MenuItem>
        <div class="menu-sep" role="separator"></div>
        <MenuItem
          role="menuitemcheckbox"
          checked={converter.invert}
          onselect={() => actions.setInvert(!converter.invert)}
        >
          Invert
        </MenuItem>
        <div class="menu-sep" role="separator"></div>
        {#each SCHEMES as option (option.value)}
          <MenuItem
            role="menuitemradio"
            checked={scheme.current === option.value}
            onselect={() => scheme.set(option.value)}
          >
            {option.label}
          </MenuItem>
        {/each}
      </Menu>

      <Menu id="help" label="Help" accessKey="h" bar>
        {#snippet trigger()}<u>H</u>elp{/snippet}
        <MenuItem onselect={actions.how}>How it works...</MenuItem>
        <div class="menu-sep" role="separator"></div>
        <MenuItem onselect={actions.about}>About R41 Link</MenuItem>
      </Menu>
    </div>
  {/snippet}

  <Workspace id="app-window-body" />

  {#snippet statusbar(onGripPointerDown)}
    <footer class="status-bar">
      <p class="status-field status-main" aria-live="polite">{converter.status}</p>
      <p class="status-field status-fixed">26×27 LCD</p>
      <span class="resize-grip" aria-hidden="true" onpointerdown={onGripPointerDown}></span>
    </footer>
  {/snippet}
</Window>
