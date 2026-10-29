import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../lib/api'
import { CHATS_PATH } from '../chat/navigation'

export type Me = {
  id: number
  username: string
  display_name: string
  avatar_url?: string
  /** Absent for guests. */
  email?: string
  /** Guest account (ADR 0008): no Google sign-in, may only chat with the owner. */
  is_guest?: boolean
  /** Shows (and so also sees) online status and last seen (ADR 0010). */
  show_presence?: boolean
}

/** Public server settings, available before sign-in. */
export type AppConfig = {
  google_enabled: boolean
  guest_enabled: boolean
  owner_username: string
}

export function useAppConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: ({ signal }) => api<AppConfig>('/config', { signal }),
    staleTime: Infinity,
  })
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

/**
 * Signs in as a guest with just a display name, opens the chat with the
 * owner (the only person guests can message), and shows it in /chats.
 */
export function useGuestSignIn(ownerUsername: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (displayName: string) => {
      await api<void>('/auth/guest', { method: 'POST', json: { display_name: displayName } })
      const chat = await api<{ id: number }>('/conversations', {
        method: 'POST',
        json: { username: ownerUsername },
      })
      return chat.id
    },
    onSuccess: async (conversationId) => {
      await queryClient.invalidateQueries({ queryKey: meQueryKey })
      navigate(CHATS_PATH, { replace: true, state: { conversationId } })
    },
  })
}

/** Backend starts the Google OIDC flow and returns the user to `next`. */
export function googleLoginUrl(next: string) {
  return `/api/v1/auth/google?next=${encodeURIComponent(next)}`
}
