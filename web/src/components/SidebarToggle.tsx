import { PanelLeft } from 'lucide-react'

/** Collapse/expand button for a desktop sidebar (hidden on phones). */
export function SidebarToggle({
  collapsed,
  onToggle,
  controls,
}: {
  collapsed: boolean
  onToggle: () => void
  /** id of the sidebar element, for aria-controls. */
  controls: string
}) {
  // One icon for both states; the label and aria-expanded say which way it goes.
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-controls={controls}
      aria-label={label}
      title={label}
      className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted/70 hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent md:inline-flex"
    >
      <PanelLeft className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  )
}
