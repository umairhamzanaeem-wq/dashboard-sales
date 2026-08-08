import type { ThemeMode } from '@/types'

export const THEME_MODES: ThemeMode[] = [
  'ignite-dark',
  'ignite-light',
  'classic-dark',
  'classic-light',
]

export const THEME_OPTIONS: Array<{
  id: ThemeMode
  label: string
  description: string
  group: 'Ignite' | 'Classic'
}> = [
  {
    id: 'ignite-dark',
    label: 'Ignite Dark',
    description: 'Black surfaces with brand red',
    group: 'Ignite',
  },
  {
    id: 'ignite-light',
    label: 'Ignite Light',
    description: 'White surfaces with brand red',
    group: 'Ignite',
  },
  {
    id: 'classic-dark',
    label: 'Classic Dark',
    description: 'Previous zinc dark with green/blue',
    group: 'Classic',
  },
  {
    id: 'classic-light',
    label: 'Classic Light',
    description: 'Previous light with green/blue',
    group: 'Classic',
  },
]

export function isDarkTheme(theme: ThemeMode): boolean {
  return theme === 'ignite-dark' || theme === 'classic-dark'
}

export function normalizeTheme(value: unknown): ThemeMode {
  if (value === 'ignite-dark' || value === 'ignite-light' || value === 'classic-dark' || value === 'classic-light') {
    return value
  }
  // Legacy settings from before 4-theme support
  if (value === 'light') return 'ignite-light'
  if (value === 'dark') return 'ignite-dark'
  return 'ignite-dark'
}

export function applyTheme(theme: ThemeMode): void {
  const next = normalizeTheme(theme)
  const root = document.documentElement
  root.setAttribute('data-theme', next)
  root.classList.toggle('dark', isDarkTheme(next))
  root.classList.toggle('light', !isDarkTheme(next))
  localStorage.setItem('bd-theme-pref', next)
}

export function readStoredTheme(): ThemeMode {
  return normalizeTheme(localStorage.getItem('bd-theme-pref'))
}

export function nextTheme(current: ThemeMode): ThemeMode {
  const i = THEME_MODES.indexOf(normalizeTheme(current))
  return THEME_MODES[(i + 1) % THEME_MODES.length]
}

/** Chart / ring accents that follow the active theme family */
export function themeAccent(theme: ThemeMode): {
  primary: string
  secondary: string
  success: string
  warning: string
} {
  const t = normalizeTheme(theme)
  if (t === 'classic-dark' || t === 'classic-light') {
    return {
      primary: '#3b82f6',
      secondary: '#22c55e',
      success: t === 'classic-light' ? '#16a34a' : '#22c55e',
      warning: '#f59e0b',
    }
  }
  return {
    primary: '#E60000',
    secondary: '#FF1A1A',
    success: t === 'ignite-light' ? '#16A34A' : '#22C55E',
    warning: '#F59E0B',
  }
}
