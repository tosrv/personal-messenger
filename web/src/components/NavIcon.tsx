import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

// Icon-only controls still need a name: `label` becomes the accessible name
// (aria-label) and the hover tooltip (title).
const base =
  'inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50'

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
    <NavLink
      to={to}
      aria-label={label}
      title={label}
      className={({ isActive }) => `${base} ${isActive ? 'bg-surface text-accent' : 'text-muted'}`}
    >
      {Icon ? <Icon className="size-5" aria-hidden /> : children}
    </NavLink>
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
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`${base} text-muted`}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  )
}
