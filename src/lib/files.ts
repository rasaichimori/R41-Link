export const MEDIA_ACCEPT = "image/*,video/*"

export const openFilePicker = (onPick: (files: FileList | null) => void, accept = MEDIA_ACCEPT) => {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = accept
  input.addEventListener("change", () => onPick(input.files), { once: true })
  input.click()
}

export const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files")
