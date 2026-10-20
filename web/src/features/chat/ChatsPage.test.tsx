import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { mockApi } from '../../test/mockApi'
import { renderWithProviders } from '../../test/render'
import { ChatsPage } from './ChatsPage'

const me = { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@x.com' }
const peer = (id: number, name: string) => ({
  id,
  username: name.toLowerCase(),
  display_name: name,
})
const conversations = [
  {
    id: 7,
    peer: peer(2, 'Alice'),
    last_message: { id: 5, sender_id: 2, body: 'See you', created_at: new Date().toISOString() },
    unread_count: 3,
    last_read_message_id: 2,
    created_at: '2026-10-01T00:00:00Z',
  },
  {
    id: 8,
    peer: peer(3, 'Bob'),
    last_message: { id: 4, sender_id: 1, body: 'Thanks!', created_at: new Date().toISOString() },
    unread_count: 0,
    last_read_message_id: 4,
    created_at: '2026-10-01T00:00:00Z',
  },
]

/** Shows the current address so tests can check it never changes. */
function WithLocation() {
  const { pathname } = useLocation()
  return (
    <>
      <output aria-label="path">{pathname}</output>
      <ChatsPage />
    </>
  )
}

function mockChats(list = conversations) {
  mockApi({
    'GET /me': () => [200, me],
    'GET /conversations': () => [200, { conversations: list }],
    'GET /conversations/7': () => [200, conversations[0]],
    'GET /conversations/7/messages': () => [
      200,
      {
        messages: [
          {
            id: 5,
            conversation_id: 7,
            sender_id: 2,
            client_message_id: 'c5',
            body: 'See you',
            created_at: '2026-10-20T08:00:00Z',
          },
        ],
        has_more: false,
      },
    ],
    'POST /conversations/7/read': () => [204],
  })
}

describe('ChatsPage', () => {
  it('lists conversations with preview, own-message prefix and unread badge', async () => {
    mockChats()
    renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })

    const list = await screen.findByRole('list', { name: 'Conversations' })
    expect(within(list).getByRole('button', { name: /Alice/ })).toBeInTheDocument()
    expect(within(list).getByText('See you')).toBeInTheDocument()
    expect(within(list).getByLabelText('3 unread')).toBeInTheDocument()
    expect(await within(list).findByText('You: Thanks!')).toBeInTheDocument()
    expect(screen.getByText('Select a conversation to start chatting.')).toBeInTheDocument()
  })

  it('opens a chat beside the list without changing the URL', async () => {
    mockChats()
    renderWithProviders(<WithLocation />, { path: '/chats', route: '/chats' })

    await userEvent.click(await screen.findByRole('button', { name: /Alice/ }))

    expect(await screen.findByRole('region', { name: 'Chat with Alice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Alice/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByLabelText('path')).toHaveTextContent(/^\/chats$/)
  })

  it('closes the chat with the back button', async () => {
    mockChats()
    renderWithProviders(<ChatsPage />, {
      path: '/chats',
      route: { pathname: '/chats', state: { conversationId: 7 } },
    })
    await screen.findByRole('region', { name: 'Chat with Alice' })

    await userEvent.click(screen.getByRole('button', { name: 'Back to chats' }))

    expect(await screen.findByText('Select a conversation to start chatting.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Chat with Alice' })).not.toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    mockChats([])
    renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })
    expect(await screen.findByText(/No conversations yet/)).toBeInTheDocument()
  })
})
