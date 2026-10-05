import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme' // also read by the pre-paint script in index.html
const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

/** Applies the theme to <html> and returns whether dark mode is active. */
function apply(theme: Theme): boolean {
  const dark = theme === 'dark' || (theme === 'system' && !!media?.matches)
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

interface ThemeState {
  theme: Theme
  isDark: boolean
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()((set, get) => {
  media?.addEventListener('change', () => set({ isDark: apply(get().theme) }))
  const theme = readTheme()
  return {
    theme,
    isDark: apply(theme),
    setTheme: (theme) => {
      try {
        if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
        else localStorage.setItem(STORAGE_KEY, theme)
      } catch {
        // storage unavailable (private mode); theme still applies for this session
      }
      set({ theme, isDark: apply(theme) })
    },
  }
})

/** True when the UI is currently dark — use for Monaco / inspector themes. */
export const useIsDark = () => useThemeStore((s) => s.isDark)
