<script lang="ts">
  import PixelIcon from "../PixelIcon.svelte"
  import Dialog from "./Dialog.svelte"

  let dialog: Dialog
  let { open = $bindable(false) }: { open?: boolean } = $props()

  export const show = () => dialog.show()
</script>

<Dialog bind:this={dialog} bind:open id="studio-about-dialog" title="About Animation Studio" class="dialog-small">
  <div class="dialog-body about-body">
    <PixelIcon name="studio" class="about-icon" />
    <div>
      <p><b>Animation Studio</b></p>
      <p>Version 0.1.0</p>
      <p>Draw frame-by-frame animations for the R41’s 26×27 LCD and export them as MIDI.</p>
    </div>
    <form method="dialog" class="dialog-actions"><button class="btn btn-default" data-autofocus>OK</button></form>
  </div>
</Dialog>
