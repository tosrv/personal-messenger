import { Navigate } from 'react-router-dom'
import { LoadingState } from '../../components/States'
import { useMe } from '../auth/api'
import { CHATS_PATH } from '../chat/navigation'
import { HomePage } from './HomePage'

/**
 * "/": the landing page is for visitors only. Signed-in users go straight to
 * their chats (replace, so Back does not bounce them to "/" again).
 */
export function HomeRoute() {
  const me = useMe()
  if (me.isPending) return <LoadingState />
  if (me.data) return <Navigate to={CHATS_PATH} replace />
  return <HomePage />
}
