import { createContext, useContext } from 'react'
import type { ConnectionStatus } from '../../lib/realtime'

/** 'idle' = signed out, so no connection is attempted. */
export type RealtimeStatus = ConnectionStatus | 'idle'

export const StatusContext = createContext<RealtimeStatus>('idle')

export function useRealtimeStatus() {
  return useContext(StatusContext)
}
