import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { GuestBadge } from '../../components/GuestBadge'
import { ErrorState, LoadingState } from '../../components/States'
import { ApiError } from '../../lib/api'
import { useMe } from '../auth/api'
import { useStartConversation } from '../chat/api'
import { useProfile } from './api'

/**
 * Public profile, framed by the same side rules as the navbar, chats and
 * settings (every state: loading, not found, error, profile).
 */
export function ProfilePage() {
  return (
    <div className="mx-auto min-h-full max-w-5xl border-line md:border-x">
      <ProfileContent />
    </div>
  )
}

function ProfileContent() {
  const { username = '' } = useParams()
  const profile = useProfile(username)
  const me = useMe()
  const start = useStartConversation()

  if (profile.isPending) return <LoadingState />
  if (profile.isError) {
    if (profile.error instanceof ApiError && profile.error.status === 404) {
      return <p className="py-16 text-center text-muted">User @{username} does not exist.</p>
    }
    return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
  }

  const u = profile.data
  const isMe = me.data?.id === u.id
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-12 text-center">
      <Avatar name={u.display_name} src={u.avatar_url} size="lg" />
      <h1 className="text-2xl font-semibold">{u.display_name}</h1>
      <p className="flex items-center gap-2 text-muted">
        @{u.username}
        {u.is_guest && <GuestBadge />}
      </p>
      {isMe ? (
        <Link to="/settings/profile" className="mt-4 text-sm text-accent hover:underline">
          This is you · Edit profile
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => start.mutate(u.username)}
          disabled={start.isPending}
          className="mt-4 rounded-lg bg-accent px-5 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
        >
          {start.isPending ? 'Opening…' : 'Message'}
        </button>
      )}
      {start.isError && (
        <p role="alert" className="text-sm text-danger">
          {start.error.message}
        </p>
      )}
    </section>
  )
}
