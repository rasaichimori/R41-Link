<script lang="ts">
  import PixelIcon from "../PixelIcon.svelte"
  import Dialog from "./Dialog.svelte"

  let dialog: Dialog

  export const show = () => dialog.show()
  export const isOpen = () => dialog.isOpen()
</script>

<Dialog bind:this={dialog} id="about-dialog" title="About R41 Link" class="dialog-small">
  <div class="dialog-body about-body">
    <PixelIcon name="app" class="about-icon" />
    <div>
      <p><b>R41 Link</b></p>
      <p>Version 0.1.0</p>
      <p>Converts images and video into MIDI for the R41’s 26×27 LCD.</p>
    </div>
    <form method="dialog" class="dialog-actions">
      <button class="btn btn-default" data-autofocus>OK</button>
    </form>
  </div>
</Dialog>
