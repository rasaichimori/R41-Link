<script lang="ts">
  import Dialog from "./Dialog.svelte"

  let dialog: Dialog
  let { open = $bindable(false) }: { open?: boolean } = $props()

  export const show = () => dialog.show()
</script>

<Dialog bind:this={dialog} bind:open id="keys-dialog" title="Keyboard shortcuts" class="dialog-keys" closable>
  <div class="dialog-body">
    <table class="keys-table">
      <tbody>
        <tr><th scope="row">P / E / A</th><td>Pencil / eraser / auto (right-click always erases)</td></tr>
        <tr><th scope="row">Space</th><td>Play / stop</td></tr>
        <tr><th scope="row">, / . or ← / →</th><td>Previous / next frame</td></tr>
        <tr><th scope="row">Home / End</th><td>First / last frame</td></tr>
        <tr><th scope="row">Shift+click, Shift+← / →</th><td>Select a range of frames</td></tr>
        <tr><th scope="row">Ctrl+A</th><td>Select all frames</td></tr>
        <tr><th scope="row">Ctrl+C / Ctrl+X</th><td>Copy / cut the selected frames</td></tr>
        <tr><th scope="row">Ctrl+V / Ctrl+Shift+V</th><td>Paste after / before the selection</td></tr>
        <tr><th scope="row">&lt; / &gt;</th><td>Move the selected frames left / right</td></tr>
        <tr><th scope="row">D</th><td>Duplicate the selected frames</td></tr>
        <tr><th scope="row">N</th><td>New blank frame</td></tr>
        <tr><th scope="row">Del / Backspace</th><td>Delete the selected frames</td></tr>
        <tr><th scope="row">O</th><td>Onion skin on / off</td></tr>
        <tr><th scope="row">[ / ]</th><td>Fewer / more onion layers</td></tr>
        <tr><th scope="row">G</th><td>Pixel grid on / off</td></tr>
        <tr><th scope="row">Ctrl+Z / Ctrl+Y</th><td>Undo / redo</td></tr>
      </tbody>
    </table>
    <p class="dialog-note">Auto draws, unless you start the stroke on a lit pixel; then it erases.</p>
    <p class="dialog-note">On the timeline, drag along the numbered ruler to scrub. Drag selected frames to move them. Right-click a frame to paste before or after it, or an empty slot to paste there.</p>
    <p class="dialog-note">Click an empty slot to add frames up to it. Shift+click adds copies of the last frame instead of blank ones.</p>
    <p class="dialog-note">On the stage, the arrow keys move a cursor and Space or Enter paints.</p>
    <form method="dialog" class="dialog-actions"><button class="btn btn-default" data-autofocus>OK</button></form>
  </div>
</Dialog>
