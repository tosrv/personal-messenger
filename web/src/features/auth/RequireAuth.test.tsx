import { screen } from '@testing-library/react'
import { mockFetch, renderWithProviders } from '../../test/render'
import { RequireAuth } from './RequireAuth'

describe('RequireAuth', () => {
  it('renders children for a logged-in user', async () => {
    mockFetch(200, { id: 1, username: 'tomy', display_name: 'Tomy' })
    renderWithProviders(<RequireAuth>secret area</RequireAuth>)
    expect(await screen.findByText('secret area')).toBeInTheDocument()
  })

  it('redirects to login when the session is missing', async () => {
    mockFetch(401, { error: 'unauthorized' })
    renderWithProviders(<RequireAuth>secret area</RequireAuth>)
    expect(await screen.findByText('other page')).toBeInTheDocument()
    expect(screen.queryByText('secret area')).not.toBeInTheDocument()
  })
})
