import { screen, within } from '@testing-library/react'
import { mockApi } from '../test/mockApi'
import { renderWithProviders } from '../test/render'
import { Layout } from './Layout'

const me = { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@x.com' }

// The realtime socket is irrelevant here; keep it from connecting.
class NoopSocket {
  close() {}
}

describe('Layout navbar', () => {
  beforeEach(() => vi.stubGlobal('WebSocket', NoopSocket))
  afterEach(() => vi.unstubAllGlobals())

  it('has only the brand and the settings avatar', async () => {
    mockApi({ 'GET /me': () => [200, me] })
    renderWithProviders(<Layout />, { path: '*', route: '/chats' })

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const profile = await within(nav).findByRole('link', { name: 'Settings (@tomy)' })
    expect(profile).toHaveAttribute('href', '/settings')
    expect(profile).toHaveAttribute('data-state', 'closed') // Radix tooltip trigger
    expect(within(nav).getByRole('link', { name: 'Messenger' })).toHaveAttribute('href', '/')
    // No Chats icon (the brand leads to chats), no search, no sign-out.
    expect(within(nav).getAllByRole('link')).toHaveLength(2)
    expect(within(nav).queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('shows a sign-in icon when signed out inside the app', async () => {
    mockApi({ 'GET /me': () => [401, { error: 'unauthorized' }] })
    renderWithProviders(<Layout />, { path: '*', route: '/u/tomy' })
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('leaves the navbar to the landing page on "/"', async () => {
    mockApi({ 'GET /me': () => [401, { error: 'unauthorized' }] })
    renderWithProviders(<Layout />, { path: '*', route: '/' })
    // Wait for the session check, then make sure the app navbar is not shown.
    await vi.waitFor(() => expect(screen.queryByRole('link', { name: 'Chats' })).toBeNull())
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })
})
