import { useQuery } from '@tanstack/react-query'
import { ApiError, api } from '../../lib/api'

export type Me = {
  id: number
  username: string
  display_name: string
  avatar_url?: string
}

export const meQueryKey = ['me'] as const

/** Current user, or null when there is no valid session (401). */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async (): Promise<Me | null> => {
      try {
        return await api<Me>('/me')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    staleTime: 5 * 60_000,
  })
}

/** Backend starts the Google OIDC flow and returns the user to `next`. */
export function googleLoginUrl(next: string) {
  return `/api/v1/auth/google?next=${encodeURIComponent(next)}`
}
