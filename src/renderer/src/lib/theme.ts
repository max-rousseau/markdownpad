import githubLightCss from 'highlight.js/styles/github.css?raw'
import githubDarkCss from 'highlight.js/styles/github-dark.css?raw'
import atomOneLightCss from 'highlight.js/styles/atom-one-light.css?raw'
import atomOneDarkCss from 'highlight.js/styles/atom-one-dark.css?raw'
import tokyoNightLightCss from 'highlight.js/styles/tokyo-night-light.css?raw'
import tokyoNightDarkCss from 'highlight.js/styles/tokyo-night-dark.css?raw'
import nordCss from 'highlight.js/styles/nord.css?raw'
import monokaiCss from 'highlight.js/styles/monokai.css?raw'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type AppTheme = 'classic' | 'dim' | 'solarized' | 'nord' | 'rose'
export type CodeTheme = 'github' | 'atom-one' | 'tokyo-night' | 'nord' | 'monokai'

const APP_THEME_CLASSES: AppTheme[] = ['classic', 'dim', 'solarized', 'nord', 'rose']

interface CodeThemeVariants {
  light?: string
  dark?: string
}

const CODE_THEME_REGISTRY: Record<CodeTheme, CodeThemeVariants> = {
  github: { light: githubLightCss, dark: githubDarkCss },
  'atom-one': { light: atomOneLightCss, dark: atomOneDarkCss },
  'tokyo-night': { light: tokyoNightLightCss, dark: tokyoNightDarkCss },
  nord: { dark: nordCss },
  monokai: { dark: monokaiCss },
}

const STYLE_ID = 'hljs-theme'

let mediaQuery: MediaQueryList | null = null
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null

function ensureStyleElement(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  return el
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function pickCodeCss(codeTheme: CodeTheme, resolved: ResolvedTheme): string {
  const variants = CODE_THEME_REGISTRY[codeTheme]
  const preferred = variants[resolved]
  if (preferred) return preferred
  // Theme doesn't ship a variant for the current mode — fall back to whichever exists.
  return variants.dark ?? variants.light ?? ''
}

export function applyCodeTheme(codeTheme: CodeTheme, resolved: ResolvedTheme): void {
  ensureStyleElement().textContent = pickCodeCss(codeTheme, resolved)
}

export function applyChrome(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function applyAppTheme(appTheme: AppTheme): void {
  const root = document.documentElement
  for (const t of APP_THEME_CLASSES) {
    root.classList.toggle(`theme-${t}`, t === appTheme)
  }
}

export function applyTheme(
  theme: Theme,
  appTheme: AppTheme,
  codeTheme: CodeTheme,
  onResolvedChange?: (r: ResolvedTheme) => void,
): void {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener)
    mediaQuery = null
    mediaListener = null
  }

  const resolved = resolve(theme)
  applyAppTheme(appTheme)
  applyChrome(resolved)
  applyCodeTheme(codeTheme, resolved)
  onResolvedChange?.(resolved)

  if (theme === 'system') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaListener = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? 'dark' : 'light'
      applyChrome(next)
      applyCodeTheme(codeTheme, next)
      onResolvedChange?.(next)
    }
    mediaQuery.addEventListener('change', mediaListener)
  }
}

export function currentResolvedTheme(): ResolvedTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
