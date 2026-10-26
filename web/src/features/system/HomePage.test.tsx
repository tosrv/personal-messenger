import { screen } from '@testing-library/react'
import { mockFetch, renderWithProviders } from '../../test/render'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('invites visitors to sign in and land in chats', async () => {
    mockFetch(401, { error: 'unauthorized' })
    renderWithProviders(<HomePage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A messengeryou actually own.',
    )
    expect(await screen.findByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google?next=%2Fchats',
    )
    expect(screen.getByRole('link', { name: 'View source' })).toHaveAttribute(
      'href',
      'https://github.com/tosrv/personal-messenger',
    )
  })

  it('sends signed-in users straight to their chats', async () => {
    mockFetch(200, { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@x.com' })
    renderWithProviders(<HomePage />)
    expect(await screen.findByRole('link', { name: 'Open chats' })).toHaveAttribute(
      'href',
      '/chats',
    )
    expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument()
  })

  it('keeps the decorative chat preview away from screen readers', () => {
    mockFetch(401, { error: 'unauthorized' })
    renderWithProviders(<HomePage />)
    expect(
      screen.queryByText('Sure, tell me more.')?.closest('[aria-hidden="true"]'),
    ).not.toBeNull()
  })
})
