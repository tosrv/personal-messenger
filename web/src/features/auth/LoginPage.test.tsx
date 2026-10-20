import { screen } from '@testing-library/react'
import { mockFetch, renderWithProviders } from '../../test/render'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('names the person a portfolio visitor is about to chat with', async () => {
    mockFetch(401, { error: 'unauthorized' })
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login?next=%2Fu%2Ftomy' })
    expect(
      await screen.findByRole('heading', { name: 'Sign in to chat with @tomy' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google?next=%2Fu%2Ftomy',
    )
  })

  it('ignores an unsafe next parameter', async () => {
    mockFetch(401, { error: 'unauthorized' })
    renderWithProviders(<LoginPage />, {
      path: '/login',
      route: '/login?next=https%3A%2F%2Fevil.test',
    })
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google?next=%2F',
    )
  })

  it('shows a friendly error after a failed sign-in', async () => {
    mockFetch(401, { error: 'unauthorized' })
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login?error=signin_failed' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in failed')
  })
})
