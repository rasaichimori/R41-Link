import { createContext } from "svelte"
import type { ConsoleLog } from "./consoleLog.svelte"
import type { Converter } from "./converter.svelte"
import type { MenuController } from "./menus.svelte"
import type { SchemeSetting } from "./scheme.svelte"
import type { Studio } from "./studio.svelte"
import type { WindowManager } from "./windows.svelte"

/** Commands shared by menus, buttons and keyboard shortcuts. Each one also echoes to the console. */
export type AppActions = {
  open: () => void
  exportMidi: () => void
  play: () => void
  rewind: () => void
  setInvert: (on: boolean) => void
  how: () => void
  about: () => void
}

export type AppContext = {
  converter: Converter
  log: ConsoleLog
  windows: WindowManager
  menus: MenuController
  scheme: SchemeSetting
  studio: Studio
  actions: AppActions
}

export const [getApp, setApp] = createContext<AppContext>()
