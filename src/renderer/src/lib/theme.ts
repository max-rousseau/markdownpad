export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type ThemePack = 'plain' | 'forest' | 'midnight' | 'solarflare' | 'cherry'

const THEME_PACK_CLASSES: ThemePack[] = ['plain', 'forest', 'midnight', 'solarflare', 'cherry']

interface MermaidConfig {
  theme: 'default' | 'dark' | 'base' | 'neutral' | 'forest'
  themeVariables?: Record<string, string>
}

interface PackVariant {
  mermaid: MermaidConfig
}

const MERMAID_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'

// Mermaid theme variables per pack × mode. Plain uses mermaid's built-in
// default/dark themes verbatim; the others use mermaid's `base` theme with
// a custom palette so the diagram chrome harmonizes with the app chrome.
export const THEME_PACKS: Record<ThemePack, { light: PackVariant; dark: PackVariant }> = {
  plain: {
    light: { mermaid: { theme: 'default' } },
    dark: { mermaid: { theme: 'dark' } },
  },
  forest: {
    light: {
      mermaid: {
        theme: 'base',
        themeVariables: {
          background: '#fdfbf6',
          primaryColor: '#a8c08c',
          primaryTextColor: '#2d3a23',
          primaryBorderColor: '#5a7a3c',
          lineColor: '#5a7a3c',
          secondaryColor: '#d4d8b8',
          tertiaryColor: '#e8ebd4',
          mainBkg: '#a8c08c',
          nodeBorder: '#5a7a3c',
          edgeLabelBackground: '#fdfbf6',
          fontFamily: MERMAID_FONT,
        },
      },
    },
    dark: {
      mermaid: {
        theme: 'base',
        themeVariables: {
          background: '#0f1a0f',
          primaryColor: '#3a5a2c',
          primaryTextColor: '#c4d4a8',
          primaryBorderColor: '#a8d68c',
          lineColor: '#a8d68c',
          secondaryColor: '#2a4220',
          tertiaryColor: '#1f2e18',
          mainBkg: '#3a5a2c',
          nodeBorder: '#a8d68c',
          edgeLabelBackground: '#162216',
          fontFamily: MERMAID_FONT,
        },
      },
    },
  },
  midnight: {
    light: {
      mermaid: {
        theme: 'base',
        themeVariables: {
          background: '#f4f6fa',
          primaryColor: '#a4b8d8',
          primaryTextColor: '#1a2440',
          primaryBorderColor: '#4060a0',
          lineColor: '#4060a0',
          secondaryColor: '#c8d4ec',
          tertiaryColor: '#dde4f2',
          mainBkg: '#a4b8d8',
          nodeBorder: '#4060a0',
          edgeLabelBackground: '#f4f6fa',
          fontFamily: MERMAID_FONT,
        },
      },
    },
    dark: {
      mermaid: {
        theme: 'base',
        themeVariables: {
          background: '#0a0e1f',
          primaryColor: '#3a4a7a',
          primaryTextColor: '#c4d0f0',
          primaryBorderColor: '#8090d0',
          lineColor: '#8090d0',
          secondaryColor: '#2a3258',
          tertiaryColor: '#1a2040',
          mainBkg: '#3a4a7a',
          nodeBorder: '#8090d0',
          edgeLabelBackground: '#121a30',
          fontFamily: MERMAID_FONT,
        },
      },
    },
  },
  solarflare: {
    light: {
      mermaid: {
        theme: 'base',
        themeVariables: {
          background: '#fdf6e8',
          primaryColor: '#f0c068',
          primaryTextColor: '#3a2818',
          primaryBorderColor: '#c84a1a',
          lineColor: '#c84a1a',
          secondaryColor: '#fad898',
          tertiaryColor: '#fce8c4',
          mainBkg: '#f0c068',
          nodeBorder: '#c84a1a',
          edgeLabelBackground: '#fdf6e8',
          fontFamily: MERMAID_FONT,
        },
      },
    },
    dark: {
      mermaid: {
        theme: 'base',
        themeVariables: {
          background: '#1a0a05',
          primaryColor: '#8a4818',
          primaryTextColor: '#f0d4a8',
          primaryBorderColor: '#f0a040',
          lineColor: '#f0a040',
          secondaryColor: '#5a300c',
          tertiaryColor: '#3a1f08',
          mainBkg: '#8a4818',
          nodeBorder: '#f0a040',
          edgeLabelBackground: '#251208',
          fontFamily: MERMAID_FONT,
        },
      },
    },
  },
  cherry: {
    light: {
      mermaid: {
        theme: 'base',
        themeVariables: {
          background: '#fef4f4',
          primaryColor: '#f0a8c8',
          primaryTextColor: '#5a1a30',
          primaryBorderColor: '#c8408c',
          lineColor: '#c8408c',
          secondaryColor: '#f8c8d8',
          tertiaryColor: '#fce0e8',
          mainBkg: '#f0a8c8',
          nodeBorder: '#c8408c',
          edgeLabelBackground: '#fef4f4',
          fontFamily: MERMAID_FONT,
        },
      },
    },
    dark: {
      mermaid: {
        theme: 'base',
        themeVariables: {
          background: '#1a0810',
          primaryColor: '#7a2848',
          primaryTextColor: '#f4c8d8',
          primaryBorderColor: '#e060a0',
          lineColor: '#e060a0',
          secondaryColor: '#5a1830',
          tertiaryColor: '#3a0e1a',
          mainBkg: '#7a2848',
          nodeBorder: '#e060a0',
          edgeLabelBackground: '#2a1018',
          fontFamily: MERMAID_FONT,
        },
      },
    },
  },
}

let mediaQuery: MediaQueryList | null = null
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function applyChrome(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function applyThemePack(pack: ThemePack): void {
  const root = document.documentElement
  for (const p of THEME_PACK_CLASSES) {
    root.classList.toggle(`pack-${p}`, p === pack)
  }
}

export function mermaidConfigFor(pack: ThemePack, resolved: ResolvedTheme): MermaidConfig {
  return THEME_PACKS[pack][resolved].mermaid
}

export function applyTheme(
  theme: Theme,
  pack: ThemePack,
  onResolvedChange?: (r: ResolvedTheme) => void,
): void {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener)
    mediaQuery = null
    mediaListener = null
  }

  const resolved = resolve(theme)
  applyThemePack(pack)
  applyChrome(resolved)
  onResolvedChange?.(resolved)

  if (theme === 'system') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaListener = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? 'dark' : 'light'
      applyChrome(next)
      onResolvedChange?.(next)
    }
    mediaQuery.addEventListener('change', mediaListener)
  }
}

export function currentResolvedTheme(): ResolvedTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
