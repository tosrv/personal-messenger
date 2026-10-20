import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { RealtimeClient, websocketUrl, type ConnectionStatus } from '../../lib/realtime'
import { useMe } from '../auth/api'
import { receiveMessage, syncAll, type Message } from '../chat/api'
import { StatusContext } from './status'

// While the socket is down, poll slowly in case only WebSockets are blocked.
const FALLBACK_POLL_MS = 15_000

/** Keeps one WebSocket open while signed in and feeds events into the query cache. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const userId = useMe().data?.id
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    if (!userId) return
    const client = new RealtimeClient({
      url: websocketUrl(),
      onStatus: setStatus,
      onConnected: () => void syncAll(queryClient),
      onEvent: (event) => {
        if (event.type === 'message.new' && event.message) {
          receiveMessage(queryClient, event.message as Message)
        }
      },
    })
    client.start()
    return () => client.stop()
  }, [userId, queryClient])

  const disconnected = Boolean(userId) && status !== 'online'
  useEffect(() => {
    if (!disconnected) return
    const timer = setInterval(() => void syncAll(queryClient), FALLBACK_POLL_MS)
    return () => clearInterval(timer)
  }, [disconnected, queryClient])

  return (
    <StatusContext.Provider value={userId ? status : 'idle'}>{children}</StatusContext.Provider>
  )
}
