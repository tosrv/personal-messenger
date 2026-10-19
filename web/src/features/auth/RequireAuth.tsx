import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/States'
import { useMe } from './api'

/** Renders children only for logged-in users; otherwise sends them to /login?next=… */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) return <LoadingState />
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />
  if (!me.data) {
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return children
}
