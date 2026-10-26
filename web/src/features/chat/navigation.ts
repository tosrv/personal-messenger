import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * The open conversation lives in the history entry's state, not in the URL,
 * so the address bar stays /chats (like WhatsApp Web). Browsers keep history
 * state across reloads, so a refresh reopens the same chat.
 */
type ChatsState = { conversationId?: number } | null

export const CHATS_PATH = '/chats'

export function useOpenConversationId(): number | null {
  const state = useLocation().state as ChatsState
  const id = state?.conversationId
  return typeof id === 'number' && id > 0 ? id : null
}

/**
 * Opens a conversation. From the list it adds a history entry, so Back
 * returns to the list (on phones, that closes the chat). Switching between
 * chats replaces the entry, so Back never steps through every chat opened.
 */
export function useOpenChat() {
  const navigate = useNavigate()
  const location = useLocation()
  const alreadyOpen =
    location.pathname === CHATS_PATH && Boolean((location.state as ChatsState)?.conversationId)
  return useCallback(
    (conversationId: number) =>
      navigate(CHATS_PATH, { state: { conversationId }, replace: alreadyOpen }),
    [navigate, alreadyOpen],
  )
}

/** Shows the list with no chat open, without a history entry (e.g. after deleting it). */
export function useResetChats() {
  const navigate = useNavigate()
  return useCallback(() => navigate(CHATS_PATH, { replace: true, state: null }), [navigate])
}

/** Closes the open chat, e.g. the ← button on phones. */
export function useCloseChat() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    // Opened from the list in this tab: going back restores the list exactly.
    if (location.key !== 'default' && window.history.length > 1) navigate(-1)
    else navigate(CHATS_PATH, { replace: true, state: null })
  }, [navigate, location.key])
}
