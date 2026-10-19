import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export type PublicProfile = {
  id: number
  username: string
  display_name: string
  avatar_url?: string
}

export const MIN_QUERY_LEN = 2

export function useUserSearch(query: string) {
  const q = query.trim().replace(/^@/, '')
  return useQuery({
    queryKey: ['users', 'search', q],
    queryFn: ({ signal }) =>
      api<{ users: PublicProfile[] }>(`/users/search?q=${encodeURIComponent(q)}`, { signal }),
    select: (data) => data.users,
    enabled: q.length >= MIN_QUERY_LEN,
    placeholderData: (prev) => prev,
  })
}

export function useProfile(username: string) {
  return useQuery({
    queryKey: ['users', 'profile', username],
    queryFn: ({ signal }) =>
      api<PublicProfile>(`/users/${encodeURIComponent(username)}`, { signal }),
  })
}
