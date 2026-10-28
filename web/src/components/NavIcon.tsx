import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Button, buttonVariants } from '@/components/ui/button'
import { WithTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Icon-only controls still need a name: `label` becomes the accessible name
// (aria-label) and the hover tooltip.
const base = 'size-9 transition-colors hover:text-fg'

export function NavIconLink({
  to,
  label,
  icon: Icon,
  children,
}: {
  to: string
  label: string
  icon?: LucideIcon
  /** Custom content instead of an icon, e.g. the user's avatar. */
  children?: ReactNode
}) {
  return (
    <WithTooltip label={label} side="right">
      <NavLink
        to={to}
        aria-label={label}
        className={({ isActive }) =>
          cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            base,
            isActive ? 'bg-surface text-accent' : 'text-muted',
          )
        }
      >
        {Icon ? <Icon className="size-5" aria-hidden /> : children}
      </NavLink>
    </WithTooltip>
  )
}

export function NavIconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <WithTooltip label={label} side="right">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={cn(base, 'text-muted')}
      >
        <Icon className="size-5" aria-hidden />
      </Button>
    </WithTooltip>
  )
}
