import { useRealtimeStatus } from './status'

/**
 * Tells the user when live updates are paused (PRD §6.5, §6.7). The banner
 * fades in after a short delay (CSS), so brief blips such as page load or a
 * quick reconnect never flash it.
 */
export function ConnectionBanner() {
  const status = useRealtimeStatus()
  if (status !== 'offline' && status !== 'connecting') return null
  return (
    <div
      role="status"
      // Overlay (not in the flow) so showing it never shifts the page.
      className="invisible absolute inset-x-0 top-0 z-10 animate-appear-delayed border-b border-line bg-surface px-4 py-1.5 text-center text-sm text-muted opacity-0 shadow-sm"
    >
      {status === 'offline'
        ? 'Connection lost. Reconnecting… Messages you send are kept until the server confirms them.'
        : 'Connecting…'}
    </div>
  )
}
