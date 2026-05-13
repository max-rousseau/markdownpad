import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type Theme = 'light' | 'dark' | 'system'

export const APP_THEMES = ['classic', 'dim', 'solarized', 'nord', 'rose'] as const
export type AppTheme = (typeof APP_THEMES)[number]

export const CODE_THEMES = [
  'github',
  'atom-one',
  'tokyo-night',
  'nord',
  'monokai',
] as const
export type CodeTheme = (typeof CODE_THEMES)[number]

export interface WindowBounds {
  width: number
  height: number
}

export interface PersistedState {
  window: WindowBounds
  openFiles: string[]
  theme: Theme
  appTheme: AppTheme
  codeTheme: CodeTheme
}

const DEFAULTS: PersistedState = {
  window: { width: 760, height: 960 },
  openFiles: [],
  theme: 'system',
  appTheme: 'classic',
  codeTheme: 'github',
}

let cached: PersistedState = {
  window: { ...DEFAULTS.window },
  openFiles: [],
  theme: DEFAULTS.theme,
  appTheme: DEFAULTS.appTheme,
  codeTheme: DEFAULTS.codeTheme,
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
      appTheme: isAppTheme(parsed.appTheme) ? parsed.appTheme : DEFAULTS.appTheme,
      codeTheme: isCodeTheme(parsed.codeTheme) ? parsed.codeTheme : DEFAULTS.codeTheme,
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

export function getCodeTheme(): CodeTheme {
  return cached.codeTheme
}

export function setCodeTheme(theme: CodeTheme): void {
  cached.codeTheme = theme
}

export function getAppTheme(): AppTheme {
  return cached.appTheme
}

export function setAppTheme(theme: AppTheme): void {
  cached.appTheme = theme
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && (APP_THEMES as readonly string[]).includes(value)
}

function isCodeTheme(value: unknown): value is CodeTheme {
  return typeof value === 'string' && (CODE_THEMES as readonly string[]).includes(value)
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
