import {
  Bell,
  ChevronRight,
  Globe,
  LogOut,
  Palette,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { SidebarToggle } from '../../components/SidebarToggle'
import { useSidebarCollapsed } from '../../lib/sidebar'
import { useLogout, useMe } from '../auth/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WithTooltip } from '@/components/ui/tooltip'

type Item = { to: string; label: string; icon: LucideIcon }

const items: Item[] = [
  { to: 'profile', label: 'Profile', icon: UserRound },
  { to: 'notifications', label: 'Notifications', icon: Bell },
  { to: 'appearance', label: 'Appearance', icon: Palette },
  { to: 'language', label: 'Language', icon: Globe },
]

/**
 * Settings, laid out like /chats: the menu on the left and the chosen page on
 * the right on wide screens; on phones, the menu first, then one page at a
 * time. /settings itself shows Profile on wide screens. On wide screens the
 * menu can be collapsed to a rail of icons.
 */
export function SettingsLayout() {
  const me = useMe()
  const atMenu = useMatch('/settings') !== null
  const { collapsed, toggle } = useSidebarCollapsed('settings')

  return (
    <div className="mx-auto flex h-full max-w-5xl md:border-x md:border-line">
      <aside
        id="settings-sidebar"
        aria-label="Settings menu"
        className={`flex w-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 motion-reduce:transition-none md:border-r md:border-line ${
          collapsed ? 'md:w-16' : 'md:w-80'
        } ${atMenu ? '' : 'hidden md:flex'}`}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 pt-3 pb-2">
            <SidebarToggle collapsed onToggle={toggle} controls="settings-sidebar" />
            {me.data && (
              <WithTooltip label={`${me.data.display_name} (@${me.data.username})`} side="right">
                <span tabIndex={0} className="rounded-full">
                  <Avatar name={me.data.display_name} src={me.data.avatar_url} />
                </span>
              </WithTooltip>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 px-3 pt-4 pb-2">
              <h1 className="text-xl font-semibold">Settings</h1>
              <SidebarToggle collapsed={false} onToggle={toggle} controls="settings-sidebar" />
            </div>
            {me.data && (
              <div className="flex items-center gap-3 px-3 py-3">
                <Avatar name={me.data.display_name} src={me.data.avatar_url} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{me.data.display_name}</p>
                  <p className="truncate text-sm text-muted">@{me.data.username}</p>
                </div>
              </div>
            )}
          </>
        )}
        <nav aria-label="Settings" className="flex min-h-0 flex-1 flex-col">
          <ul
            className={`min-h-0 flex-1 overflow-y-auto ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}
          >
            {items.map((item) => (
              <MenuLink key={item.to} item={item} collapsed={collapsed} atMenu={atMenu} />
            ))}
          </ul>
          <ul
            className={`border-t border-line py-1 ${collapsed ? 'flex flex-col items-center' : ''}`}
          >
            {/* Pinned to the bottom so it is always in view; signs out immediately. */}
            <SignOutButton collapsed={collapsed} />
          </ul>
        </nav>
      </aside>

      <div className={`min-w-0 flex-1 overflow-y-auto ${atMenu ? 'hidden md:block' : ''}`}>
        <Outlet />
      </div>
    </div>
  )
}

function MenuLink({
  item: { to, label, icon: Icon },
  collapsed,
  atMenu,
}: {
  item: Item
  collapsed: boolean
  atMenu: boolean
}) {
  return (
    <li>
      <WithTooltip label={label} side="right" disabled={!collapsed}>
        <NavLink
          to={to}
          className={({ isActive }) => {
            // On wide screens /settings shows Profile, so mark it active too.
            const active = isActive || (atMenu && to === 'profile')
            const shape = collapsed
              ? 'inline-flex size-10 items-center justify-center rounded-full'
              : 'flex items-center gap-3 px-3 py-3'
            return `${shape} hover:bg-surface focus-visible:bg-surface ${active ? 'md:bg-surface' : ''}`
          }}
        >
          <Icon className="size-5 text-muted" aria-hidden />
          {/* Kept for screen readers when collapsed. */}
          <span className={collapsed ? 'sr-only' : 'flex-1'}>{label}</span>
          {!collapsed && <ChevronRight className="size-4 text-muted md:hidden" aria-hidden />}
        </NavLink>
      </WithTooltip>
    </li>
  )
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const logout = useLogout()
  const label = logout.isPending ? 'Signing out…' : 'Sign out'
  return (
    <li>
      <WithTooltip label={label} side="right" disabled={!collapsed}>
        <Button
          type="button"
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className={cn(
            'font-normal text-danger focus-visible:bg-surface',
            !collapsed && 'w-full justify-start gap-3 rounded-none px-3 py-3 text-left',
          )}
        >
          <LogOut className="size-5" aria-hidden />
          <span className={collapsed ? 'sr-only' : 'flex-1'}>{label}</span>
        </Button>
      </WithTooltip>
      {logout.isError && !collapsed && (
        <p role="alert" className="px-3 pb-2 text-xs text-danger">
          {logout.error.message}
        </p>
      )}
    </li>
  )
}
