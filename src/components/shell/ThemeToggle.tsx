import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type Theme } from '@/stores/theme.store'
import { Button } from '@/components/ui/button'

const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const icons = { system: Monitor, light: Sun, dark: Moon }

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore()
  const Icon = icons[theme]
  return (
    <Button
      variant='ghost'
      size='icon-sm'
      onClick={() => setTheme(next[theme])}
      title={`Theme: ${theme} (click for ${next[theme]})`}
      aria-label={`Theme: ${theme}. Switch to ${next[theme]}`}
    >
      <Icon />
    </Button>
  )
}
