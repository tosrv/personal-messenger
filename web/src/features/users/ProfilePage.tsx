import { useParams } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { ErrorState, LoadingState } from '../../components/States'
import { ApiError } from '../../lib/api'
import { useProfile } from './api'

export function ProfilePage() {
  const { username = '' } = useParams()
  const profile = useProfile(username)

  if (profile.isPending) return <LoadingState />
  if (profile.isError) {
    if (profile.error instanceof ApiError && profile.error.status === 404) {
      return <p className="py-16 text-center text-muted">User @{username} does not exist.</p>
    }
    return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
  }

  const u = profile.data
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-12 text-center">
      <Avatar name={u.display_name} src={u.avatar_url} size="lg" />
      <h1 className="text-2xl font-semibold">{u.display_name}</h1>
      <p className="text-muted">@{u.username}</p>
      {/* M3: "Message" button → open or create a direct conversation (hidden on own profile). */}
    </section>
  )
}
