import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom has no matchMedia. Tests run as a wide (desktop) screen unless they
// set `window.__testWideScreen = false` first.
declare global {
  interface Window {
    __testWideScreen?: boolean
  }
}
window.matchMedia = (query: string) =>
  ({
    matches: query.includes('min-width') ? window.__testWideScreen !== false : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  delete window.__testWideScreen
})
