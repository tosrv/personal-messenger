import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

export const MAX_MESSAGE_LENGTH = 4000
const PAGE_SIZE = 50
// Until real-time arrives in M4, new messages are fetched on an interval.
const POLL_MS = 4000

export type Peer = {
  id: number
  username: string
  display_name: string
  avatar_url?: string
}

export type Conversation = {
  id: number
  peer: Peer
  last_message: { id: number; sender_id: number; body: string; created_at: string } | null
  unread_count: number
  last_read_message_id: number
  created_at: string
}

export type Message = {
  id: number
  conversation_id: number
  sender_id: number
  client_message_id: string
  body: string
  created_at: string
}

type Page = { messages: Message[]; has_more: boolean }
type MessagePages = InfiniteData<Page, number>

export const conversationsKey = ['conversations'] as const
const conversationKey = (id: number) => ['conversations', id] as const
const messagesKey = (id: number) => ['messages', id] as const

export function useConversations() {
  return useQuery({
    queryKey: conversationsKey,
    queryFn: ({ signal }) => api<{ conversations: Conversation[] }>('/conversations', { signal }),
    select: (data) => data.conversations,
    refetchInterval: POLL_MS,
  })
}

export function useConversation(id: number) {
  return useQuery({
    queryKey: conversationKey(id),
    queryFn: ({ signal }) => api<Conversation>(`/conversations/${id}`, { signal }),
  })
}

/** Opens (or creates) the direct conversation with `username` and navigates to it. */
export function useStartConversation() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (username: string) =>
      api<Conversation>('/conversations', { method: 'POST', json: { username } }),
    onSuccess: (c) => navigate(`/c/${c.id}`),
  })
}

/**
 * Message history, newest page first. Each page is in ascending ID order;
 * fetching the "next" page loads older messages.
 */
export function useMessages(conversationId: number) {
  return useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    queryFn: ({ pageParam, signal }) =>
      api<Page>(
        `/conversations/${conversationId}/messages?limit=${PAGE_SIZE}&before=${pageParam}`,
        { signal },
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.messages[0]?.id : undefined),
    // Pages are kept current by appendMessages, never by refetching every page.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** Polls for messages newer than the newest one in the cache and appends them. */
export function usePollNewMessages(conversationId: number, enabled: boolean) {
  const queryClient = useQueryClient()
  useQuery({
    queryKey: ['messages', conversationId, 'poll'],
    queryFn: async ({ signal }) => {
      for (;;) {
        const after = newestMessageId(queryClient, conversationId)
        const page = await api<Page>(
          `/conversations/${conversationId}/messages?limit=${PAGE_SIZE}&after=${after}`,
          { signal },
        )
        appendMessages(queryClient, conversationId, page.messages)
        if (!page.has_more) return Date.now()
      }
    },
    enabled,
    refetchInterval: POLL_MS,
    staleTime: 0,
  })
}

export function useSendMessage(conversationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { clientMessageId: string; body: string }) =>
      api<Message>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        json: { client_message_id: input.clientMessageId, body: input.body },
      }),
    onSuccess: (m) => {
      appendMessages(queryClient, conversationId, [m])
      void queryClient.invalidateQueries({ queryKey: conversationsKey, exact: true })
    },
  })
}

export function useMarkRead(conversationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: number) =>
      api<void>(`/conversations/${conversationId}/read`, {
        method: 'POST',
        json: { message_id: messageId },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: conversationsKey }),
  })
}

/**
 * Merges messages into the newest page of the cache, ignoring ones already
 * present. Real-time events (M4) will use this too.
 */
export function appendMessages(qc: QueryClient, conversationId: number, incoming: Message[]) {
  if (incoming.length === 0) return
  qc.setQueryData<MessagePages>(messagesKey(conversationId), (data) => {
    if (!data) return data
    const known = new Set(data.pages.flatMap((p) => p.messages.map((m) => m.id)))
    const fresh = incoming.filter((m) => !known.has(m.id))
    if (fresh.length === 0) return data
    const [newest, ...older] = data.pages
    const merged = [...newest.messages, ...fresh].sort((a, b) => a.id - b.id)
    return { ...data, pages: [{ ...newest, messages: merged }, ...older] }
  })
}

function newestMessageId(qc: QueryClient, conversationId: number): number {
  const data = qc.getQueryData<MessagePages>(messagesKey(conversationId))
  const newest = data?.pages[0]?.messages
  return newest?.length ? newest[newest.length - 1].id : 0
}
