import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WithTooltip } from '@/components/ui/tooltip'

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
    <WithTooltip label={label} side={collapsed ? 'right' : 'bottom'}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={controls}
        aria-label={label}
        className="hidden size-7 rounded-md text-muted/70 hover:text-fg md:inline-flex"
      >
        <PanelLeft className="size-4" strokeWidth={1.75} aria-hidden />
      </Button>
    </WithTooltip>
  )
}
