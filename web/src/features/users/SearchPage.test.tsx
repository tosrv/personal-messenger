import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, renderWithProviders } from '../../test/render'
import { SearchPage } from './SearchPage'

describe('SearchPage', () => {
  it('does not search until the query is long enough', async () => {
    const fetchSpy = mockFetch(200, { users: [] })
    renderWithProviders(<SearchPage />)
    await userEvent.type(screen.getByLabelText('Search by username'), 't')
    expect(screen.getByText(/at least 2 characters/)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('lists matching users linking to their profiles', async () => {
    mockFetch(200, { users: [{ id: 1, username: 'tomy', display_name: 'Tomy' }] })
    renderWithProviders(<SearchPage />)
    await userEvent.type(screen.getByLabelText('Search by username'), 'to')
    const link = await screen.findByRole('link', { name: /Tomy/ })
    expect(link).toHaveAttribute('href', '/u/tomy')
  })

  it('shows an empty state when nothing matches', async () => {
    mockFetch(200, { users: [] })
    renderWithProviders(<SearchPage />)
    await userEvent.type(screen.getByLabelText('Search by username'), 'zz')
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })
})
