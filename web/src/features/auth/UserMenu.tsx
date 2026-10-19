import { Link, NavLink } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { useLogout, useMe } from './api'

export function UserMenu() {
  const me = useMe()
  const logout = useLogout()

  if (me.isPending) return null
  if (!me.data) {
    return (
      <Link
        to="/login"
        className="rounded-md px-2 py-1 text-sm font-medium text-accent hover:underline"
      >
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <NavLink
        to="/settings"
        className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-surface"
        title="Account settings"
      >
        <Avatar name={me.data.display_name} src={me.data.avatar_url} size="sm" />
        <span className="hidden sm:inline">@{me.data.username}</span>
      </NavLink>
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="rounded-md px-2 py-1 text-sm text-muted hover:text-fg disabled:opacity-50"
      >
        Sign out
      </button>
    </div>
  )
}
