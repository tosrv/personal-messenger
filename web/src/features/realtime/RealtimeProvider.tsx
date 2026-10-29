import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RealtimeClient, websocketUrl, type ConnectionStatus } from '../../lib/realtime'
import { useMe } from '../auth/api'
import { receiveMessage, syncAll, type Message } from '../chat/api'
import { StatusContext } from './status'
import { createTypingThrottle, TypingContext, useTypingState } from './typing'

// While the socket is down, poll slowly in case only WebSockets are blocked.
const FALLBACK_POLL_MS = 15_000

/** Keeps one WebSocket open while signed in and feeds events into the query cache. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const userId = useMe().data?.id
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const throttle = useRef<ReturnType<typeof createTypingThrottle> | null>(null)
  const { typing, start: startTyping, stop: stopTyping } = useTypingState()

  useEffect(() => {
    if (!userId) return
    const c = new RealtimeClient({
      url: websocketUrl(),
      onStatus: setStatus,
      onConnected: () => void syncAll(queryClient),
      onEvent: (event) => {
        if (event.type === 'message.new' && event.message) {
          const m = event.message as Message
          stopTyping(m.conversation_id, m.sender_id)
          receiveMessage(queryClient, m)
        } else if (
          event.type === 'typing' &&
          typeof event.conversation_id === 'number' &&
          typeof event.user_id === 'number'
        ) {
          startTyping(event.conversation_id, event.user_id)
        }
      },
    })
    throttle.current = createTypingThrottle((conversationId) =>
      c.send({ type: 'typing', conversation_id: conversationId }),
    )
    c.start()
    return () => {
      c.stop()
      throttle.current = null
    }
  }, [userId, queryClient, startTyping, stopTyping])

  const disconnected = Boolean(userId) && status !== 'online'
  useEffect(() => {
    if (!disconnected) return
    const timer = setInterval(() => void syncAll(queryClient), FALLBACK_POLL_MS)
    return () => clearInterval(timer)
  }, [disconnected, queryClient])

  const notifyTyping = useCallback((id: number) => throttle.current?.notify(id), [])
  const resetTyping = useCallback((id: number) => throttle.current?.reset(id), [])
  const typingValue = useMemo(
    () => ({ typing, notifyTyping, resetTyping }),
    [typing, notifyTyping, resetTyping],
  )

  return (
    <StatusContext.Provider value={userId ? status : 'idle'}>
      <TypingContext.Provider value={typingValue}>{children}</TypingContext.Provider>
    </StatusContext.Provider>
  )
}
