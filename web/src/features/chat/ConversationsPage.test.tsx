import { screen } from '@testing-library/react'
import { mockApi } from '../../test/mockApi'
import { renderWithProviders } from '../../test/render'
import { ConversationsPage } from './ConversationsPage'

const peer = (id: number, name: string) => ({
  id,
  username: name.toLowerCase(),
  display_name: name,
})

describe('ConversationsPage', () => {
  it('lists conversations with preview, own-message prefix and unread badge', async () => {
    mockApi({
      'GET /me': () => [200, { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@x.com' }],
      'GET /conversations': () => [
        200,
        {
          conversations: [
            {
              id: 7,
              peer: peer(2, 'Alice'),
              last_message: {
                id: 5,
                sender_id: 2,
                body: 'See you',
                created_at: new Date().toISOString(),
              },
              unread_count: 3,
              last_read_message_id: 2,
              created_at: '2026-10-01T00:00:00Z',
            },
            {
              id: 8,
              peer: peer(3, 'Bob'),
              last_message: {
                id: 4,
                sender_id: 1,
                body: 'Thanks!',
                created_at: new Date().toISOString(),
              },
              unread_count: 0,
              last_read_message_id: 4,
              created_at: '2026-10-01T00:00:00Z',
            },
          ],
        },
      ],
    })
    renderWithProviders(<ConversationsPage />)

    expect(await screen.findByRole('link', { name: /Alice/ })).toHaveAttribute('href', '/c/7')
    expect(screen.getByText('See you')).toBeInTheDocument()
    expect(screen.getByLabelText('3 unread')).toBeInTheDocument()
    expect(await screen.findByText('You: Thanks!')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    mockApi({
      'GET /me': () => [200, { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@x.com' }],
      'GET /conversations': () => [200, { conversations: [] }],
    })
    renderWithProviders(<ConversationsPage />)
    expect(await screen.findByText(/No conversations yet/)).toBeInTheDocument()
  })
})
