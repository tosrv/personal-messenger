import { useCallback, useState, useSyncExternalStore } from 'react'

/** Tailwind's `md` breakpoint: side-by-side layouts start here. */
const WIDE_QUERY = '(min-width: 768px)'

/** True on screens wide enough to show a sidebar next to the content. */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(WIDE_QUERY)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  )
}

/**
 * Collapsed/expanded state of a sidebar, remembered per sidebar on this
 * device. Collapsing only applies on wide screens; on phones the sidebar is
 * already a full screen of its own.
 */
export function useSidebarCollapsed(name: string) {
  const key = `pm-sidebar-${name}`
  const [stored, setStored] = useState(() => {
    try {
      return localStorage.getItem(key) === 'collapsed'
    } catch {
      return false
    }
  })
  const wide = useIsWide()

  const toggle = useCallback(() => {
    setStored((prev) => {
      const next = !prev
      try {
        if (next) localStorage.setItem(key, 'collapsed')
        else localStorage.removeItem(key)
      } catch {
        // Storage blocked: the choice lasts until reload.
      }
      return next
    })
  }, [key])

  return { collapsed: wide && stored, toggle }
}
