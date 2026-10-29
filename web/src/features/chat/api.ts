import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useOpenChat } from './navigation'

export const MAX_MESSAGE_LENGTH = 4000
const PAGE_SIZE = 50

export type Peer = {
  id: number
  username: string
  display_name: string
  avatar_url?: string
  is_guest?: boolean
}

/** The peer's online status; absent when either side hides presence (ADR 0010). */
export type Presence = { online: boolean; last_seen_at: string | null }

export type Conversation = {
  id: number
  peer: Peer
  last_message: { id: number; sender_id: number; body: string; created_at: string } | null
  unread_count: number
  last_read_message_id: number
  /** The peer has read the viewer's messages up to this id (read receipts). */
  peer_last_read_message_id: number
  peer_presence?: Presence
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
  })
}

export function useConversation(id: number) {
  return useQuery({
    queryKey: conversationKey(id),
    queryFn: ({ signal }) => api<Conversation>(`/conversations/${id}`, { signal }),
  })
}

/** Opens (or creates) the direct conversation with `username` and shows it in /chats. */
export function useStartConversation() {
  const openChat = useOpenChat()
  return useMutation({
    mutationFn: (username: string) =>
      api<Conversation>('/conversations', { method: 'POST', json: { username } }),
    onSuccess: (c) => openChat(c.id),
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

/**
 * Deletes the chat for the current user only ("delete for me"): it leaves
 * their list and its history is hidden from them; the other person keeps it.
 */
export function useDeleteChat(conversationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/conversations/${conversationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: messagesKey(conversationId) })
      queryClient.removeQueries({ queryKey: conversationKey(conversationId) })
      queryClient.setQueryData<{ conversations: Conversation[] }>(
        conversationsKey,
        (data) =>
          data && { conversations: data.conversations.filter((c) => c.id !== conversationId) },
      )
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
 * Fetches every message newer than the newest cached one for a conversation
 * and appends them. Called after (re)connecting so nothing sent while we were
 * offline is missed (PRD §6.5).
 */
export async function syncNewMessages(qc: QueryClient, conversationId: number) {
  if (!qc.getQueryData(messagesKey(conversationId))) return // not open; loads fresh later
  for (;;) {
    const after = newestMessageId(qc, conversationId)
    const page = await api<Page>(
      `/conversations/${conversationId}/messages?limit=${PAGE_SIZE}&after=${after}`,
    )
    appendMessages(qc, conversationId, page.messages)
    if (!page.has_more) return
  }
}

/** Resyncs every conversation in the cache and refreshes the conversation list. */
export async function syncAll(qc: QueryClient) {
  const ids = qc
    .getQueriesData<MessagePages>({ queryKey: ['messages'] })
    .map(([key]) => key[1])
    .filter((id): id is number => typeof id === 'number')
  await Promise.allSettled(ids.map((id) => syncNewMessages(qc, id)))
  await qc.invalidateQueries({ queryKey: conversationsKey })
}

/** Applies a "message.new" event pushed by the server. */
export function receiveMessage(qc: QueryClient, m: Message) {
  appendMessages(qc, m.conversation_id, [m])
  void qc.invalidateQueries({ queryKey: conversationsKey })
}

/**
 * Applies a "conversation.read" event. When the peer read, their marker moves
 * forward in the cache (read receipts). When it was the current user in
 * another tab, unread counts are refetched.
 */
export function receiveRead(
  qc: QueryClient,
  event: { conversation_id: number; user_id: number; last_read_message_id: number },
  myId: number | undefined,
) {
  if (event.user_id === myId) {
    void qc.invalidateQueries({ queryKey: conversationsKey })
    return
  }
  const bump = (c: Conversation): Conversation =>
    c.id === event.conversation_id && event.last_read_message_id > c.peer_last_read_message_id
      ? { ...c, peer_last_read_message_id: event.last_read_message_id }
      : c
  qc.setQueryData<Conversation>(conversationKey(event.conversation_id), (c) => c && bump(c))
  qc.setQueryData<{ conversations: Conversation[] }>(
    conversationsKey,
    (data) => data && { conversations: data.conversations.map(bump) },
  )
}

/**
 * Applies a "presence" event to every cached conversation with that user.
 * online=false with last_seen_at=null means they now hide their presence.
 */
export function receivePresence(
  qc: QueryClient,
  event: { user_id: number; online: boolean; last_seen_at: string | null },
) {
  const presence: Presence | undefined =
    event.online || event.last_seen_at
      ? { online: event.online, last_seen_at: event.online ? null : event.last_seen_at }
      : undefined
  const apply = (c: Conversation): Conversation =>
    c.peer.id === event.user_id ? { ...c, peer_presence: presence } : c
  qc.setQueriesData<Conversation>(
    { predicate: (q) => q.queryKey[0] === 'conversations' && typeof q.queryKey[1] === 'number' },
    (c) => c && apply(c),
  )
  qc.setQueryData<{ conversations: Conversation[] }>(
    conversationsKey,
    (data) => data && { conversations: data.conversations.map(apply) },
  )
}

/** Merges messages into the newest page of the cache, ignoring ones already present. */
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
