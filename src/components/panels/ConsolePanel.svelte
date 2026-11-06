<script lang="ts">
  import { tick } from "svelte"
  import type { Attachment } from "svelte/attachments"
  import { getApp } from "../../lib/context"

  const { log } = getApp()

  const followOutput: Attachment<HTMLElement> = (console) => {
    void log.version
    void tick().then(() => (console.scrollTop = console.scrollHeight))
  }
</script>

<section class="group console-group" aria-labelledby="console-heading">
  <h2 class="group-title" id="console-heading">Console</h2>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="console" role="log" aria-label="Console output" tabindex="0" {@attach followOutput}>
    <p>R41 Link [Version 0.1.0]</p>
    <p>26x27 LCD to MIDI converter</p>
    <p>&nbsp;</p>
    <div>
      {#each log.lines as line (line.id)}
        <p class={{ "is-cmd": line.command }}>{line.text}</p>
      {/each}
    </div>
    <p class="console-prompt">C:\R41LINK&gt;<span class="console-cursor"></span></p>
  </div>
</section>
