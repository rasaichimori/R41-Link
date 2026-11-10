import { flushSync } from "svelte"

type MenuEntry = {
  id: string
  /** Alt+key opens it (menubar menus only) */
  accessKey?: string
  /** Part of the menubar, so Left/Right and hover move between these */
  bar: boolean
  root: HTMLElement
}

const triggerOf = (entry: MenuEntry) => entry.root.querySelector<HTMLElement>(":scope > button")
const popupOf = (entry: MenuEntry) => entry.root.querySelector<HTMLElement>(":scope > .menu-popup")

export class MenuController {
  openId = $state<string | null>(null)
  #entries: MenuEntry[] = []
  #returnFocus: Element | null = null

  register = (entry: MenuEntry) => {
    this.#entries.push(entry)
    return () => {
      this.#entries = this.#entries.filter((other) => other !== entry)
      if (this.openId === entry.id) this.openId = null
    }
  }

  #find = (id: string | null) => this.#entries.find((entry) => entry.id === id)

  get #barMenus() {
    return this.#entries.filter((entry) => entry.bar)
  }

  itemsOf = (id: string) => {
    const popup = popupOf(this.#find(id)!)
    if (!popup) return []
    return [...popup.querySelectorAll<HTMLElement>("button[role^='menuitem']")].filter((item) => !item.hidden)
  }

  isBarMenu = (id: string) => Boolean(this.#find(id)?.bar)

  contains = (target: EventTarget | null) => {
    const open = this.#find(this.openId)
    return Boolean(open && target instanceof Node && open.root.contains(target))
  }

  close = (restoreFocus = false) => {
    if (!this.openId) return
    this.openId = null
    if (restoreFocus) {
      const target = this.#returnFocus && document.contains(this.#returnFocus) ? this.#returnFocus : null
      if (target instanceof HTMLElement && target !== document.body) target.focus()
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }
    this.#returnFocus = null
  }

  show = (id: string, focusFirst = false) => {
    if (this.openId === id) return
    const entry = this.#find(id)
    if (!entry) return
    const previous = this.#returnFocus
    this.close()
    this.#returnFocus = previous ?? (entry.root.contains(document.activeElement) ? null : document.activeElement)
    this.openId = id
    if (!focusFirst) return
    flushSync()
    this.itemsOf(id)[0]?.focus()
  }

  toggle = (id: string, focusFirst = false) => {
    if (this.openId === id) this.close(true)
    else this.show(id, focusFirst)
  }

  #sameWindow = (a: MenuEntry, b: MenuEntry) => a.root.closest(".window") === b.root.closest(".window")

  /** Hovering another menubar title while one is open switches to it. */
  hover = (id: string) => {
    const open = this.#find(this.openId)
    const next = this.#find(id)
    if (!open || !next || open === next || !open.bar || !next.bar || !this.#sameWindow(open, next)) return
    this.show(id)
  }

  /** Left/Right from an open menubar menu moves to its neighbour in the same window. */
  step = (id: string, direction: 1 | -1) => {
    const current = this.#find(id)
    if (!current) return false
    const bar = this.#barMenus.filter((entry) => this.#sameWindow(entry, current))
    const index = bar.findIndex((entry) => entry.id === id)
    if (index < 0) return false
    this.show(bar[(index + direction + bar.length) % bar.length].id, true)
    return true
  }

  /** Alt+key opens the menubar menu in `within` when that window is given. */
  openByKey = (key: string, within?: HTMLElement | null) => {
    const matches = this.#barMenus.filter((candidate) => candidate.accessKey === key.toLowerCase())
    const entry = within ? matches.find((candidate) => within.contains(candidate.root)) : matches[0]
    if (!entry) return false
    this.show(entry.id, true)
    return true
  }

  focusTrigger = (id: string) => {
    const entry = this.#find(id)
    if (entry) triggerOf(entry)?.focus()
  }
}
