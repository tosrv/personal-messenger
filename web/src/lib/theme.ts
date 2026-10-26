import { useCallback, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

// Must match public/theme-init.js, which applies the theme before React loads.
const STORAGE_KEY = 'pm-theme'

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Saves the preference on this device and applies it immediately. */
export function applyThemePreference(pref: ThemePreference) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Storage blocked: the choice still applies until the page is reloaded.
  }
}

export function useThemePreference() {
  const [pref, setPref] = useState(readThemePreference)
  const set = useCallback((next: ThemePreference) => {
    applyThemePreference(next)
    setPref(next)
  }, [])
  return [pref, set] as const
}
