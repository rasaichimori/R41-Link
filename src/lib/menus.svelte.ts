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

  /** Hovering another menubar title while one is open switches to it. */
  hover = (id: string) => {
    if (this.openId && this.openId !== id && this.isBarMenu(id) && this.isBarMenu(this.openId)) this.show(id)
  }

  /** Left/Right from an open menubar menu moves to its neighbour. */
  step = (id: string, direction: 1 | -1) => {
    const bar = this.#barMenus
    const index = bar.findIndex((entry) => entry.id === id)
    if (index < 0) return false
    this.show(bar[(index + direction + bar.length) % bar.length].id, true)
    return true
  }

  openByKey = (key: string) => {
    const entry = this.#barMenus.find((candidate) => candidate.accessKey === key.toLowerCase())
    if (!entry) return false
    this.show(entry.id, true)
    return true
  }

  focusTrigger = (id: string) => {
    const entry = this.#find(id)
    if (entry) triggerOf(entry)?.focus()
  }
}
