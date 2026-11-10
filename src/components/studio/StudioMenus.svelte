<script lang="ts">
  import { getApp } from "../../lib/context"
  import type { Scheme } from "../../lib/scheme.svelte"
  import Menu from "../menu/Menu.svelte"
  import MenuItem from "../menu/MenuItem.svelte"

  const { studio, scheme } = getApp()

  const SCHEMES: { value: Scheme; label: string }[] = [
    { value: "auto", label: "Match system colors" },
    { value: "light", label: "Standard colors" },
    { value: "dark", label: "Night colors" },
  ]

  const choose = (action: string) => () => studio.perform(action)
</script>

<div class="menubar" role="menubar" aria-label="Animation Studio">
  <Menu id="studio-file" label="File" accessKey="f" bar>
    {#snippet trigger()}<u>F</u>ile{/snippet}
    <MenuItem onselect={choose("new")}>New animation</MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem onselect={choose("export")}>Export MIDI...</MenuItem>
  </Menu>

  <Menu id="studio-edit" label="Edit" accessKey="e" bar>
    {#snippet trigger()}<u>E</u>dit{/snippet}
    <MenuItem disabled={!studio.canUndo} shortcut="Ctrl+Z" onselect={choose("undo")}>Undo</MenuItem>
    <MenuItem disabled={!studio.canRedo} shortcut="Ctrl+Y" onselect={choose("redo")}>Redo</MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem shortcut="Ctrl+X" onselect={choose("cut")}>Cut frames</MenuItem>
    <MenuItem shortcut="Ctrl+C" onselect={choose("copy")}>Copy frames</MenuItem>
    <MenuItem disabled={studio.clipboardEmpty} shortcut="Ctrl+V" onselect={choose("paste-after")}>Paste after</MenuItem>
    <MenuItem disabled={studio.clipboardEmpty} shortcut="Ctrl+Shift+V" onselect={choose("paste-before")}>Paste before</MenuItem>
    <MenuItem disabled={studio.clipboardEmpty} onselect={choose("paste-replace")}>Paste over selection</MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem shortcut="D" onselect={choose("duplicate")}>Duplicate frames</MenuItem>
    <MenuItem shortcut="N" onselect={choose("blank")}>New blank frame</MenuItem>
    <MenuItem shortcut="Del" onselect={choose("delete")}>Delete frames</MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem disabled={studio.selStart === 0} shortcut="<" onselect={choose("move-left")}>Move frames left</MenuItem>
    <MenuItem disabled={studio.selEnd === studio.frames.length - 1} shortcut=">" onselect={choose("move-right")}>
      Move frames right
    </MenuItem>
    <MenuItem shortcut="Ctrl+A" onselect={choose("select-all")}>Select all frames</MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem onselect={choose("clear")}>Clear frames</MenuItem>
    <MenuItem onselect={choose("invert")}>Invert frames</MenuItem>
  </Menu>

  <Menu id="studio-view" label="View" accessKey="v" bar>
    {#snippet trigger()}<u>V</u>iew{/snippet}
    <MenuItem role="menuitemcheckbox" checked={studio.onion} shortcut="O" onselect={choose("toggle-onion")}>
      Onion skin
    </MenuItem>
    <MenuItem role="menuitemcheckbox" checked={studio.onionNext} onselect={choose("toggle-onion-next")}>
      Show next frames
    </MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem role="menuitemcheckbox" checked={studio.grid} shortcut="G" onselect={choose("toggle-grid")}>
      Pixel grid
    </MenuItem>
    <MenuItem role="menuitemcheckbox" checked={studio.blocks} onselect={choose("toggle-blocks")}>Note blocks</MenuItem>
    <div class="menu-sep" role="separator"></div>
    {#each SCHEMES as item (item.value)}
      <MenuItem role="menuitemradio" checked={scheme.current === item.value} onselect={() => studio.setScheme(item.value)}>
        {item.label}
      </MenuItem>
    {/each}
  </Menu>

  <Menu id="studio-control" label="Control" accessKey="c" bar>
    {#snippet trigger()}<u>C</u>ontrol{/snippet}
    <MenuItem shortcut="Space" onselect={choose("play")}>{studio.playing ? "Stop" : "Play"}</MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem shortcut="Home" onselect={choose("first")}>First frame</MenuItem>
    <MenuItem shortcut="," onselect={choose("prev")}>Previous frame</MenuItem>
    <MenuItem shortcut="." onselect={choose("next")}>Next frame</MenuItem>
    <MenuItem shortcut="End" onselect={choose("last")}>Last frame</MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem role="menuitemcheckbox" checked={studio.loop} onselect={choose("toggle-loop")}>Loop playback</MenuItem>
  </Menu>

  <Menu id="studio-help" label="Help" accessKey="h" bar>
    {#snippet trigger()}<u>H</u>elp{/snippet}
    <MenuItem onselect={choose("keys")}>Keyboard shortcuts...</MenuItem>
    <div class="menu-sep" role="separator"></div>
    <MenuItem onselect={choose("about")}>About Animation Studio</MenuItem>
  </Menu>
</div>
