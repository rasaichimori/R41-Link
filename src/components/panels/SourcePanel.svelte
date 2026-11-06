<script lang="ts">
  import { getApp } from "../../lib/context"
  import PixelIcon from "../PixelIcon.svelte"

  const { converter, actions } = getApp()

  let dragOver = $state(false)

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    actions.open()
  }

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    dragOver = true
  }

  // The file itself is loaded by the page-wide drop handler in App
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    dragOver = false
  }
</script>

<section class="group panel-source" aria-labelledby="source-heading">
  <h2 class="group-title" id="source-heading">Source</h2>
  <div
    class={["dropzone", dragOver && "is-dragover"]}
    role="button"
    tabindex="0"
    aria-label="Open media"
    aria-describedby="file-name"
    onclick={actions.open}
    onkeydown={onKeydown}
    ondragover={onDragOver}
    ondragleave={() => (dragOver = false)}
    ondrop={onDrop}
  >
    <PixelIcon name="folder" class="dropzone-icon" />
    <p class="dropzone-label">Drag an image, GIF or video here</p>
    <span class="btn btn-fake" aria-hidden="true">Browse...</span>
  </div>
  <p class="dropzone-hint">
    <span class="dropzone-hint-key">File:</span>
    <span class="dropzone-file" id="file-name">{converter.fileName ?? "(none)"}</span>
  </p>
</section>
