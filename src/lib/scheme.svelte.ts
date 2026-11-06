export type Scheme = "auto" | "light" | "dark"

const SCHEME_KEY = "r41-link-scheme"

export class SchemeSetting {
  current = $state<Scheme>("auto")

  constructor() {
    try {
      const saved = localStorage.getItem(SCHEME_KEY)
      if (saved) this.set(saved, false)
    } catch {
      /* storage unavailable */
    }
  }

  set = (next: string | undefined, persist = true) => {
    const scheme: Scheme = next === "light" || next === "dark" ? next : "auto"
    this.current = scheme
    const root = document.documentElement
    if (scheme === "auto") delete root.dataset.theme
    else root.dataset.theme = scheme
    if (!persist) return
    try {
      localStorage.setItem(SCHEME_KEY, scheme)
    } catch {
      /* storage unavailable */
    }
  }
}
