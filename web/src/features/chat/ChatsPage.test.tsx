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
    expect(screen.getByText(/Select a conversation/)).toBeInTheDocument()
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

    expect(await screen.findByText(/Select a conversation/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Chat with Alice' })).not.toBeInTheDocument()
  })

  describe('search', () => {
    function mockSearch(onStart = () => {}) {
      mockApi({
        'GET /me': () => [200, me],
        'GET /conversations': () => [200, { conversations }],
        'GET /users/search': (_, url) => {
          const q = url.searchParams.get('q')
          return q === 'al'
            ? [200, { users: [peer(2, 'Alice'), peer(4, 'Alfred')] }] // Alice already in chats
            : [200, { users: [] }]
        },
        'POST /conversations': () => {
          onStart()
          return [200, { ...conversations[0], id: 9, peer: peer(4, 'Alfred') }]
        },
        'GET /conversations/9': () => [
          200,
          { ...conversations[0], id: 9, peer: peer(4, 'Alfred'), last_message: null },
        ],
        'GET /conversations/9/messages': () => [200, { messages: [], has_more: false }],
      })
    }

    it('shows matching chats and new people, without duplicates', async () => {
      mockSearch()
      renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })
      await screen.findByRole('list', { name: 'Conversations' })

      await userEvent.type(screen.getByLabelText('Search chats or people'), 'al')

      const chats = await screen.findByRole('region', { name: 'Chats' })
      expect(within(chats).getByRole('button', { name: /Alice/ })).toBeInTheDocument()
      const people = await screen.findByRole('region', { name: 'People' })
      expect(within(people).getByRole('button', { name: /Alfred/ })).toBeInTheDocument()
      expect(within(people).queryByRole('button', { name: /Alice/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Conversations' })).not.toBeInTheDocument()
    })

    it('starts a chat with a new person and clears the search', async () => {
      let started = 0
      mockSearch(() => started++)
      renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })
      await screen.findByRole('list', { name: 'Conversations' })

      const box = screen.getByLabelText('Search chats or people')
      await userEvent.type(box, 'al')
      await userEvent.click(await screen.findByRole('button', { name: /Alfred/ }))

      expect(await screen.findByRole('region', { name: 'Chat with Alfred' })).toBeInTheDocument()
      expect(started).toBe(1)
      expect(box).toHaveValue('')
    })

    it('never sends a query the server would reject (spaces), and clears back to the list', async () => {
      mockSearch()
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })
      await screen.findByRole('list', { name: 'Conversations' })

      await userEvent.type(screen.getByLabelText('Search chats or people'), 'bo b')

      expect(await screen.findByText(/No chats or people found/)).toBeInTheDocument()
      // "bo" alone is a valid username prefix and may be searched while typing.
      const searched = fetchSpy.mock.calls
        .map(([u]) => String(u))
        .filter((u) => u.includes('/users/search'))
      expect(searched.some((u) => /q=bo(%20|\+| )b/.test(u))).toBe(false)
      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(await screen.findByRole('list', { name: 'Conversations' })).toBeInTheDocument()
    })
  })

  describe('collapsible sidebar', () => {
    it('collapses to avatars with unread dots, and the choice is remembered', async () => {
      mockChats()
      renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })
      await screen.findByRole('list', { name: 'Conversations' })

      const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await userEvent.click(toggle)

      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
      expect(screen.queryByLabelText('Search chats or people', { selector: 'input' })).toBeNull()
      // Names move to accessible labels/tooltips; unread count stays announced.
      const alice = screen.getByRole('button', { name: 'Alice, 3 unread' })
      expect(alice).toHaveAttribute('title', 'Alice, 3 unread')
      expect(alice).not.toHaveTextContent('See you')
      expect(localStorage.getItem('pm-sidebar-chats')).toBe('collapsed')

      await userEvent.click(alice)
      expect(await screen.findByRole('region', { name: 'Chat with Alice' })).toBeInTheDocument()
    })

    it('expands and focuses search from the collapsed rail', async () => {
      localStorage.setItem('pm-sidebar-chats', 'collapsed')
      mockChats()
      renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })

      await userEvent.click(await screen.findByRole('button', { name: 'Search chats or people' }))

      const box = await screen.findByLabelText('Search chats or people', { selector: 'input' })
      await vi.waitFor(() => expect(box).toHaveFocus())
      expect(localStorage.getItem('pm-sidebar-chats')).toBeNull()
    })

    it('never collapses on phones', async () => {
      window.__testWideScreen = false
      localStorage.setItem('pm-sidebar-chats', 'collapsed')
      mockChats()
      renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })

      expect(await screen.findByRole('button', { name: /Alice/ })).toHaveTextContent('See you')
      expect(screen.getByLabelText('Search chats or people', { selector: 'input' })).toBeVisible()
    })
  })

  it('shows an empty state', async () => {
    mockChats([])
    renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })
    expect(await screen.findByText(/No conversations yet/)).toBeInTheDocument()
  })
})

describe('delete chat', () => {
  function mockDeletable(status = 204) {
    let deleted = false
    mockApi({
      'GET /me': () => [200, me],
      'GET /conversations': () => [
        200,
        { conversations: deleted ? conversations.slice(1) : conversations },
      ],
      'GET /conversations/7': () => [200, conversations[0]],
      'GET /conversations/7/messages': () => [200, { messages: [], has_more: false }],
      'POST /conversations/7/read': () => [204],
      'DELETE /conversations/7': () => {
        if (status === 204) deleted = true
        return status === 204 ? [204] : [status, { error: 'internal server error' }]
      },
    })
    return () => deleted
  }
  const openAlice = () =>
    renderWithProviders(<ChatsPage />, {
      path: '/chats',
      route: { pathname: '/chats', state: { conversationId: 7 } },
    })

  it('asks for confirmation, then removes the chat and closes it', async () => {
    const wasDeleted = mockDeletable()
    openAlice()
    await screen.findByRole('region', { name: 'Chat with Alice' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete chat' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete chat with Alice?' })
    expect(dialog).toHaveTextContent('@alice still has them')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete chat' }))

    await vi.waitFor(() => expect(wasDeleted()).toBe(true))
    expect(await screen.findByText(/Select a conversation/)).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Conversations' })
    expect(within(list).queryByRole('button', { name: /Alice/ })).not.toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /Bob/ })).toBeInTheDocument()
  })

  it('cancels with Escape without deleting', async () => {
    const wasDeleted = mockDeletable()
    openAlice()
    await screen.findByRole('region', { name: 'Chat with Alice' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete chat' }))
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Chat with Alice' })).toBeInTheDocument()
    expect(wasDeleted()).toBe(false)
  })

  it('keeps the dialog open and explains when deleting fails', async () => {
    mockDeletable(500)
    openAlice()
    await screen.findByRole('region', { name: 'Chat with Alice' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete chat' }))
    const dialog = screen.getByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete chat' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('internal server error')
    expect(screen.getByRole('region', { name: 'Chat with Alice' })).toBeInTheDocument()
  })
})

describe('guests in chats', () => {
  it('hides search from guests, who can only chat with the owner', async () => {
    mockApi({
      'GET /me': () => [
        200,
        { id: 9, username: 'guest_1234', display_name: 'Budi', is_guest: true },
      ],
      'GET /conversations': () => [200, { conversations: [conversations[0]] }],
    })
    renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })
    await screen.findByRole('list', { name: 'Conversations' })
    expect(screen.queryByLabelText('Search chats or people')).not.toBeInTheDocument()
  })

  it('marks guest contacts with a badge', async () => {
    mockApi({
      'GET /me': () => [200, me],
      'GET /conversations': () => [
        200,
        { conversations: [{ ...conversations[0], peer: { ...peer(2, 'Budi'), is_guest: true } }] },
      ],
    })
    renderWithProviders(<ChatsPage />, { path: '/chats', route: '/chats' })
    const row = await screen.findByRole('button', { name: /Budi/ })
    expect(row).toHaveTextContent('Guest')
  })
})
