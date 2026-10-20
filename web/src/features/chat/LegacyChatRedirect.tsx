import { Navigate, useParams } from 'react-router-dom'
import { CHATS_PATH } from './navigation'

/** Old /c/7 links → /chats with conversation 7 open. */
export function LegacyChatRedirect() {
  const id = Number(useParams().id)
  return <Navigate to={CHATS_PATH} replace state={id > 0 ? { conversationId: id } : null} />
}
