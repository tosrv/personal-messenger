/** Whole calendar days from `d` to `now` in local time (0 = same day, 1 = yesterday). */
function calendarDaysAgo(d: Date, now: Date): number {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  return Math.round((start(now) - start(d)) / 86_400_000)
}

/** Groups messages by local calendar day. */
export function dayKey(iso: string): string {
  return new Date(iso).toDateString()
}

/**
 * Conversation list time: "14:05" today, "Yesterday", "Mon" within the last
 * week, otherwise "12 Oct" (or "12 Oct 2025" for another year).
 */
export function formatShortTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const days = calendarDaysAgo(d, now)
  if (days <= 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

/**
 * Date separator in a chat, like WhatsApp: "Today", "Yesterday", "Monday"
 * within the last week, otherwise "12 October" (or "12 October 2025").
 */
export function formatDayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const days = calendarDaysAgo(d, now)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Chat header status for an offline peer: "last seen just now", "… 5 min
 * ago", "… today at 14:05", "… yesterday at 21:04", or "… 12 Oct".
 */
export function formatLastSeen(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (minutes < 1) return 'last seen just now'
  if (minutes < 60) return `last seen ${minutes} min ago`
  const days = calendarDaysAgo(d, now)
  if (days <= 0) return `last seen today at ${formatTime(iso)}`
  if (days === 1) return `last seen yesterday at ${formatTime(iso)}`
  return `last seen ${formatShortTime(iso, now)}`
}
