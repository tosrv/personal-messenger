import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { conversationsKey, useConversations, type Conversation, type Message } from '../chat/api'
import { CHATS_PATH, useOpenChat, useOpenConversationId } from '../chat/navigation'
import { badgeTitle, playChime, preview, shouldNotify } from './notify'
import { readNotificationPrefs, systemNotificationsSupported } from './prefs'

/**
 * In-app notifications (ADR 0010, no Web Push): keeps the unread count in
 * the tab title, and returns a handler for incoming messages that plays the
 * chime and shows a system notification while the tab is hidden, according
 * to the user's preferences on this device.
 */
export function useInAppNotifications(myId: number | undefined) {
  const queryClient = useQueryClient()
  const conversations = useConversations({ enabled: myId !== undefined })
  const unread = myId ? (conversations.data ?? []).reduce((sum, c) => sum + c.unread_count, 0) : 0

  useEffect(() => {
    document.title = badgeTitle(unread)
  }, [unread])

  // The handler is created once; it reads where the user is from this ref.
  const openChat = useOpenChat()
  const onChats = useLocation().pathname === CHATS_PATH
  const openId = useOpenConversationId()
  const latest = useRef({ openChat, openConversationId: null as number | null })
  useEffect(() => {
    latest.current = { openChat, openConversationId: onChats ? openId : null }
  })

  return useCallback(
    (m: Message) => {
      const visible = document.visibilityState === 'visible'
      const { openConversationId } = latest.current
      if (!shouldNotify(m, { myId, openConversationId, visible })) return

      const prefs = readNotificationPrefs()
      if (prefs.sound) playChime()
      if (
        prefs.desktop &&
        !visible &&
        systemNotificationsSupported() &&
        Notification.permission === 'granted'
      ) {
        const peer = queryClient
          .getQueryData<{ conversations: Conversation[] }>(conversationsKey)
          ?.conversations.find((c) => c.id === m.conversation_id)?.peer
        const n = new Notification(peer?.display_name ?? 'New message', {
          body: preview(m.body),
          // One notification per chat: a newer message replaces the older one.
          tag: `conversation-${m.conversation_id}`,
        })
        n.onclick = () => {
          window.focus()
          latest.current.openChat(m.conversation_id)
          n.close()
        }
      }
    },
    [myId, queryClient],
  )
}
