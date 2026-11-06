const MAX_LINES = 300

export type ConsoleLine = { id: number; text: string; command: boolean }

export class ConsoleLog {
  lines = $state<ConsoleLine[]>([])
  /** Bumps on every write, including in-place merges. */
  version = $state(0)
  #lastPattern: string | null = null
  #nextId = 0

  /** With `merge`, a line that only differs from the previous one in its numbers replaces it. */
  add = (text: string, { command = false, merge = false } = {}) => {
    const pattern = text.replace(/\d+/g, "#")
    const last = this.lines.at(-1)
    if (merge && last && pattern === this.#lastPattern) {
      last.text = text
    } else {
      this.lines.push({ id: this.#nextId++, text, command })
      if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES)
    }
    this.#lastPattern = command ? null : pattern
    this.version += 1
  }

  command = (text: string) => this.add(`C:\\R41LINK>${text}`, { command: true })
}
