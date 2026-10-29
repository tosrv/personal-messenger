import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '../../test/mockApi'
import { renderWithProviders } from '../../test/render'
import { TypingContext } from '../realtime/typing'
import { ChatsPage } from './ChatsPage'

const me = { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@x.com' }
const conversation = {
  id: 7,
  peer: { id: 2, username: 'alice', display_name: 'Alice' },
  last_message: null,
  unread_count: 0,
  last_read_message_id: 0,
  created_at: '2026-10-20T08:00:00Z',
}
const hello = {
  id: 10,
  conversation_id: 7,
  sender_id: 2,
  client_message_id: 'c-10',
  body: 'Hello from Alice',
  created_at: '2026-10-20T08:01:00Z',
}

function renderChat(
  send: (body: { client_message_id: string; body: string }) => [number, unknown?],
) {
  const sends: { client_message_id: string; body: string }[] = []
  mockApi({
    'GET /me': () => [200, me],
    'GET /conversations/7': () => [200, conversation],
    'GET /conversations/7/messages': (_, url) =>
      url.searchParams.has('after')
        ? [200, { messages: [], has_more: false }]
        : [200, { messages: [hello], has_more: false }],
    'POST /conversations/7/read': () => [204],
    'GET /conversations': () => [200, { conversations: [] }],
    'POST /conversations/7/messages': (init) => {
      const body = JSON.parse(String(init?.body))
      sends.push(body)
      return send(body)
    },
  })
  renderWithProviders(<ChatsPage />, {
    path: '/chats',
    route: { pathname: '/chats', state: { conversationId: 7 } },
  })
  return sends
}

describe('ChatPanel (open chat in /chats)', () => {
  it('shows history and confirms a sent message', async () => {
    renderChat((b) => [
      201,
      { ...hello, id: 11, sender_id: 1, client_message_id: b.client_message_id, body: b.body },
    ])
    expect(await screen.findByText('Hello from Alice')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Message'), 'Hi Alice{Enter}')

    expect(await screen.findByText('Hi Alice')).toBeInTheDocument()
    expect(screen.queryByText('Sending…')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toHaveValue('')
  })

  it('marks a failed send and retries with the same client id', async () => {
    let fail = true
    const sends = renderChat((b) =>
      fail
        ? [500, { error: 'internal server error' }]
        : [
            201,
            {
              ...hello,
              id: 11,
              sender_id: 1,
              client_message_id: b.client_message_id,
              body: b.body,
            },
          ],
    )
    await screen.findByText('Hello from Alice')

    await userEvent.type(screen.getByLabelText('Message'), 'Are you there?{Enter}')
    expect(await screen.findByText(/Not sent/)).toBeInTheDocument()

    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Are you there?')).toBeInTheDocument()
    expect(screen.queryByText(/Not sent/)).not.toBeInTheDocument()
    expect(sends).toHaveLength(2)
    expect(sends[1].client_message_id).toBe(sends[0].client_message_id)
  })

  it('marks the newest message from the peer as read', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderChat(() => [500])
    await screen.findByText('Hello from Alice')
    await vi.waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/conversations/7/read') && init?.body === '{"message_id":10}',
        ),
      ).toBe(true),
    )
  })
})

describe('ChatPanel date separators', () => {
  it('groups messages under Yesterday and Today like WhatsApp', async () => {
    const now = new Date()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 5)
    const msg = (id: number, at: Date, body: string) => ({
      id,
      conversation_id: 7,
      sender_id: 2,
      client_message_id: `c-${id}`,
      body,
      created_at: at.toISOString(),
    })
    mockApi({
      'GET /me': () => [200, me],
      'GET /conversations/7': () => [200, conversation],
      'GET /conversations/7/messages': () => [
        200,
        {
          messages: [
            msg(1, yesterday, 'first'),
            msg(2, yesterday, 'second'),
            msg(3, today, 'third'),
          ],
          has_more: false,
        },
      ],
      'POST /conversations/7/read': () => [204],
      'GET /conversations': () => [200, { conversations: [] }],
    })
    renderWithProviders(<ChatsPage />, {
      path: '/chats',
      route: { pathname: '/chats', state: { conversationId: 7 } },
    })

    await screen.findByText('third')
    const list = screen.getByRole('list', { name: 'Messages' })
    const order = Array.from(list.querySelectorAll('li')).map((li) =>
      li.getAttribute('role') === 'separator'
        ? `[${li.textContent}]`
        : li.querySelector('p')?.textContent,
    )
    expect(order).toEqual(['[Yesterday]', 'first', 'second', '[Today]', 'third'])
  })
})

describe('ChatPanel typing indicator', () => {
  function renderWithTyping(typing: Map<number, number>, notifyTyping = vi.fn()) {
    const resetTyping = vi.fn()
    mockApi({
      'GET /me': () => [200, me],
      'GET /conversations/7': () => [200, conversation],
      'GET /conversations/7/messages': () => [200, { messages: [hello], has_more: false }],
      'POST /conversations/7/read': () => [204],
      'GET /conversations': () => [200, { conversations: [conversation] }],
      'POST /conversations/7/messages': (init) => [
        201,
        { ...hello, id: 11, sender_id: 1, ...JSON.parse(String(init?.body)) },
      ],
    })
    renderWithProviders(
      <TypingContext.Provider value={{ typing, notifyTyping, resetTyping }}>
        <ChatsPage />
      </TypingContext.Provider>,
      { path: '/chats', route: { pathname: '/chats', state: { conversationId: 7 } } },
    )
    return { notifyTyping, resetTyping }
  }

  it('shows "typing…" in the header and the conversation list while the peer types', async () => {
    renderWithTyping(new Map([[7, 2]]))
    await screen.findByText('Hello from Alice')
    expect(await screen.findAllByText('typing…')).toHaveLength(2)
  })

  it('shows nothing when nobody is typing', async () => {
    renderWithTyping(new Map())
    await screen.findByText('Hello from Alice')
    expect(screen.queryByText('typing…')).not.toBeInTheDocument()
  })

  it('signals typing while composing and resets after sending', async () => {
    const { notifyTyping, resetTyping } = renderWithTyping(new Map())
    await screen.findByText('Hello from Alice')
    await userEvent.type(screen.getByLabelText('Message'), 'Hi')
    expect(notifyTyping).toHaveBeenCalledWith(7)
    await userEvent.type(screen.getByLabelText('Message'), '{Enter}')
    expect(resetTyping).toHaveBeenCalledWith(7)
  })
})
