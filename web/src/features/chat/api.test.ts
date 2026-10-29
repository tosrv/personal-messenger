import { QueryClient, type InfiniteData } from '@tanstack/react-query'
import { mockApi } from '../../test/mockApi'
import {
  receiveMessage,
  receivePresence,
  receiveRead,
  syncNewMessages,
  type Conversation,
  type Message,
} from './api'

type Pages = InfiniteData<{ messages: Message[]; has_more: boolean }, number>

const msg = (id: number): Message => ({
  id,
  conversation_id: 7,
  sender_id: 2,
  client_message_id: `c-${id}`,
  body: `m${id}`,
  created_at: '2026-10-20T08:00:00Z',
})

function clientWith(ids: number[]) {
  const qc = new QueryClient()
  qc.setQueryData<Pages>(['messages', 7], {
    pages: [{ messages: ids.map(msg), has_more: false }],
    pageParams: [0],
  })
  return qc
}

const cachedIds = (qc: QueryClient) =>
  qc.getQueryData<Pages>(['messages', 7])!.pages[0].messages.map((m) => m.id)

describe('receiveMessage', () => {
  it('appends in order and ignores duplicates', () => {
    const qc = clientWith([1, 2])
    receiveMessage(qc, msg(4))
    receiveMessage(qc, msg(3))
    receiveMessage(qc, msg(4))
    expect(cachedIds(qc)).toEqual([1, 2, 3, 4])
  })

  it('ignores conversations that are not loaded', () => {
    const qc = new QueryClient()
    receiveMessage(qc, msg(1))
    expect(qc.getQueryData(['messages', 7])).toBeUndefined()
  })
})

describe('syncNewMessages', () => {
  it('fetches everything after the newest cached message, page by page', async () => {
    const afters: string[] = []
    mockApi({
      'GET /conversations/7/messages': (_, url) => {
        const after = url.searchParams.get('after')!
        afters.push(after)
        return after === '2'
          ? [200, { messages: [msg(3), msg(4)], has_more: true }]
          : [200, { messages: [msg(5)], has_more: false }]
      },
    })
    const qc = clientWith([1, 2])
    await syncNewMessages(qc, 7)
    expect(afters).toEqual(['2', '4'])
    expect(cachedIds(qc)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('receiveRead', () => {
  const conv = (peerRead: number): Conversation => ({
    id: 7,
    peer: { id: 2, username: 'alice', display_name: 'Alice' },
    last_message: null,
    unread_count: 0,
    last_read_message_id: 0,
    peer_last_read_message_id: peerRead,
    created_at: '2026-10-20T08:00:00Z',
  })

  function seeded(peerRead: number) {
    const qc = new QueryClient()
    qc.setQueryData(['conversations', 7], conv(peerRead))
    qc.setQueryData(['conversations'], { conversations: [conv(peerRead)] })
    return qc
  }
  const peerRead = (qc: QueryClient) => [
    qc.getQueryData<Conversation>(['conversations', 7])!.peer_last_read_message_id,
    qc.getQueryData<{ conversations: Conversation[] }>(['conversations'])!.conversations[0]
      .peer_last_read_message_id,
  ]

  it("moves the peer's marker forward in the chat and the list, never back", () => {
    const qc = seeded(5)
    receiveRead(qc, { conversation_id: 7, user_id: 2, last_read_message_id: 9 }, 1)
    expect(peerRead(qc)).toEqual([9, 9])
    receiveRead(qc, { conversation_id: 7, user_id: 2, last_read_message_id: 3 }, 1)
    expect(peerRead(qc)).toEqual([9, 9])
  })

  it('refetches unread counts when the current user read in another tab', () => {
    const qc = seeded(5)
    const spy = vi.spyOn(qc, 'invalidateQueries')
    receiveRead(qc, { conversation_id: 7, user_id: 1, last_read_message_id: 9 }, 1)
    expect(peerRead(qc)).toEqual([5, 5])
    expect(spy).toHaveBeenCalledWith({ queryKey: ['conversations'] })
  })
})

describe('receivePresence', () => {
  const conv = (id: number, peerId: number): Conversation => ({
    id,
    peer: { id: peerId, username: `u${peerId}`, display_name: `U${peerId}` },
    last_message: null,
    unread_count: 0,
    last_read_message_id: 0,
    peer_last_read_message_id: 0,
    created_at: '2026-10-20T08:00:00Z',
  })

  it('updates that peer in the chat and the list, and drops it when hidden', () => {
    const qc = new QueryClient()
    qc.setQueryData(['conversations', 7], conv(7, 2))
    qc.setQueryData(['conversations'], { conversations: [conv(7, 2), conv(8, 3)] })
    const chat = () => qc.getQueryData<Conversation>(['conversations', 7])!.peer_presence
    const list = () =>
      qc
        .getQueryData<{ conversations: Conversation[] }>(['conversations'])!
        .conversations.map((c) => c.peer_presence)

    receivePresence(qc, { user_id: 2, online: true, last_seen_at: null })
    expect(chat()).toEqual({ online: true, last_seen_at: null })
    expect(list()).toEqual([{ online: true, last_seen_at: null }, undefined])

    receivePresence(qc, { user_id: 2, online: false, last_seen_at: '2026-10-29T08:00:00Z' })
    expect(chat()).toEqual({ online: false, last_seen_at: '2026-10-29T08:00:00Z' })

    receivePresence(qc, { user_id: 2, online: false, last_seen_at: null })
    expect(chat()).toBeUndefined()
    expect(list()).toEqual([undefined, undefined])
  })
})
