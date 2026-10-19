import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../lib/api'

export type Me = {
  id: number
  username: string
  display_name: string
  avatar_url?: string
  email: string
}

export const meQueryKey = ['me'] as const

/** Current user, or null when there is no valid session (401). */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async ({ signal }): Promise<Me | null> => {
      try {
        return await api<Me>('/me', { signal })
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    staleTime: 5 * 60_000,
  })
}

/** Ends the session on the server, clears all cached data, and goes home. */
export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(meQueryKey, null)
      navigate('/', { replace: true })
    },
  })
}

/** Backend starts the Google OIDC flow and returns the user to `next`. */
export function googleLoginUrl(next: string) {
  return `/api/v1/auth/google?next=${encodeURIComponent(next)}`
}
