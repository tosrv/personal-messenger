/** "14:05" for today, "Mon" within a week, otherwise "12 Oct" (or "12 Oct 2025"). */
export function formatShortTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
