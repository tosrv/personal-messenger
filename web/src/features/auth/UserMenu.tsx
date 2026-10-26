import { LogIn } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { NavIconLink } from '../../components/NavIcon'
import { useMe } from './api'

/** Avatar → settings (profile, appearance, language, sign out), or a sign-in icon. */
export function UserMenu() {
  const me = useMe()

  if (me.isPending) return null
  if (!me.data) return <NavIconLink to="/login" label="Sign in" icon={LogIn} />

  return (
    <NavIconLink to="/settings" label={`Settings (@${me.data.username})`}>
      <Avatar name={me.data.display_name} src={me.data.avatar_url} size="sm" />
    </NavIconLink>
  )
}
