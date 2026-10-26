import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '../../test/mockApi'
import { renderWithProviders } from '../../test/render'
import { LoginPage } from './LoginPage'

const config = { google_enabled: true, guest_enabled: true, owner_username: 'rahmattomy' }

describe('guest sign-in', () => {
  it('signs in with just a name and opens the chat with the owner', async () => {
    const sent: { path: string; body: unknown }[] = []
    let signedIn = false
    mockApi({
      'GET /me': () =>
        signedIn
          ? [200, { id: 9, username: 'guest_1234', display_name: 'Budi', is_guest: true }]
          : [401, { error: 'unauthorized' }],
      'GET /config': () => [200, config],
      'POST /auth/guest': (init) => {
        sent.push({ path: '/auth/guest', body: JSON.parse(String(init?.body)) })
        signedIn = true
        return [201]
      },
      'POST /conversations': (init) => {
        sent.push({ path: '/conversations', body: JSON.parse(String(init?.body)) })
        return [200, { id: 5 }]
      },
    })
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' })

    expect(await screen.findByText(/You can message @rahmattomy only/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Your name'), 'Budi')
    await userEvent.click(screen.getByRole('button', { name: 'Start chat' }))

    expect(await screen.findByText('other page')).toBeInTheDocument() // navigated to /chats
    expect(sent).toEqual([
      { path: '/auth/guest', body: { display_name: 'Budi' } },
      { path: '/conversations', body: { username: 'rahmattomy' } },
    ])
  })

  it('is hidden when guest mode is off', async () => {
    mockApi({
      'GET /me': () => [401, { error: 'unauthorized' }],
      'GET /config': () => [200, { ...config, guest_enabled: false, owner_username: '' }],
    })
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' })
    expect(await screen.findByRole('link', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument()
  })

  it('shows the server error, e.g. when rate limited', async () => {
    mockApi({
      'GET /me': () => [401, { error: 'unauthorized' }],
      'GET /config': () => [200, config],
      'POST /auth/guest': () => [429, { error: 'too many requests, please slow down' }],
    })
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' })
    await userEvent.type(await screen.findByLabelText('Your name'), 'Spam')
    await userEvent.click(screen.getByRole('button', { name: 'Start chat' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('too many requests')
  })
})
