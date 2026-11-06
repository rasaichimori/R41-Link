import type { Attachment } from "svelte/attachments"

/**
 * Sets min and max before value: a range input clamps `value` to whatever
 * bounds it has at the moment it is assigned.
 */
export const rangeBounds =
  (min: number, max: number, value: number): Attachment<HTMLInputElement> =>
  (input) => {
    input.min = String(min)
    input.max = String(max)
    input.value = String(value)
  }

/** Run `callback` whenever any of `targets` changes size. Returns a cleanup. */
export const observeResize = (callback: () => void, ...targets: (Element | null | undefined)[]) => {
  const observer = new ResizeObserver(callback)
  for (const target of targets) if (target) observer.observe(target)
  return () => observer.disconnect()
}
