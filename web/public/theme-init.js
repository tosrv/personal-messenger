// Applies the saved theme before the first paint so the page never flashes
// the wrong colours. Kept as a separate file (not inline) so the strict
// Content-Security-Policy (script-src 'self') still allows it.
// Keep the storage key in sync with src/lib/theme.ts.
try {
  var theme = localStorage.getItem('pm-theme')
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme
  }
} catch {
  // Storage blocked (private mode, etc.): fall back to the system theme.
}
