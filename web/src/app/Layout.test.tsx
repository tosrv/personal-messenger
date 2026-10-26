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

  it('has only Chats and the settings avatar, as icons with accessible names', async () => {
    mockApi({ 'GET /me': () => [200, me] })
    renderWithProviders(<Layout />, { route: '/' })

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const chats = within(nav).getByRole('link', { name: 'Chats' })
    const profile = await within(nav).findByRole('link', { name: 'Settings (@tomy)' })

    expect(chats).toHaveAttribute('href', '/chats')
    expect(profile).toHaveAttribute('href', '/settings')
    for (const el of [chats, profile]) {
      expect(el).toHaveAttribute('title') // hover tooltip
      expect(el.textContent?.trim().replace(/^T$/, '')).toBe('') // no visible text label
    }
    // Search lives in the chats page and sign-out in settings.
    expect(within(nav).queryByRole('link', { name: /search/i })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('shows a sign-in icon when signed out', async () => {
    mockApi({ 'GET /me': () => [401, { error: 'unauthorized' }] })
    renderWithProviders(<Layout />, { route: '/' })
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })
})
