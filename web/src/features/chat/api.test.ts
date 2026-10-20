import { QueryClient, type InfiniteData } from '@tanstack/react-query'
import { mockApi } from '../../test/mockApi'
import { receiveMessage, syncNewMessages, type Message } from './api'

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
