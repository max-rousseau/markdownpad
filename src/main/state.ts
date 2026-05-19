import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type Theme = 'light' | 'dark' | 'system'

export const THEME_PACKS = ['plain', 'forest', 'midnight', 'solarflare', 'cherry'] as const
export type ThemePack = (typeof THEME_PACKS)[number]

export interface WindowBounds {
  width: number
  height: number
}

export interface PersistedState {
  window: WindowBounds
  openFiles: string[]
  theme: Theme
  themePack: ThemePack
}

const DEFAULTS: PersistedState = {
  window: { width: 760, height: 960 },
  openFiles: [],
  theme: 'system',
  themePack: 'plain',
}

let cached: PersistedState = {
  window: { ...DEFAULTS.window },
  openFiles: [],
  theme: DEFAULTS.theme,
  themePack: DEFAULTS.themePack,
}
let loaded = false

const windowFiles = new Map<number, string | null>()

const filePath = (): string => join(app.getPath('userData'), 'state.json')

export function loadState(): PersistedState {
  if (loaded) return cached
  loaded = true
  try {
    const raw = readFileSync(filePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    cached = {
      window: { ...DEFAULTS.window, ...(parsed.window ?? {}) },
      openFiles: Array.isArray(parsed.openFiles)
        ? parsed.openFiles.filter((p) => typeof p === 'string')
        : [],
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULTS.theme,
      themePack: isThemePack(parsed.themePack) ? parsed.themePack : DEFAULTS.themePack,
    }
  } catch {
    // No state yet, or unreadable — fall back to defaults silently.
  }
  return cached
}

export function updateWindowBounds(bounds: WindowBounds): void {
  cached.window = { ...cached.window, ...bounds }
}

export function getTheme(): Theme {
  return cached.theme
}

export function setTheme(theme: Theme): void {
  cached.theme = theme
}

export function getThemePack(): ThemePack {
  return cached.themePack
}

export function setThemePack(pack: ThemePack): void {
  cached.themePack = pack
}

export function cycleThemePack(): ThemePack {
  const i = THEME_PACKS.indexOf(cached.themePack)
  const next = THEME_PACKS[(i + 1) % THEME_PACKS.length]
  cached.themePack = next
  return next
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isThemePack(value: unknown): value is ThemePack {
  return typeof value === 'string' && (THEME_PACKS as readonly string[]).includes(value)
}

export function setWindowFile(windowId: number, path: string | null): void {
  windowFiles.set(windowId, path)
}

export function removeWindow(windowId: number): void {
  windowFiles.delete(windowId)
}

export function persistState(): void {
  cached.openFiles = Array.from(windowFiles.values()).filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  )
  try {
    const path = filePath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(cached, null, 2), 'utf8')
  } catch (err) {
    console.error('[markdownpad] failed to persist state:', err)
  }
}
