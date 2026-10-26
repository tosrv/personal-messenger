import { screen, within } from '@testing-library/react'
import { mockFetch, renderWithProviders } from '../../test/render'
import { HomePage } from './HomePage'
import { LANDING_SECTIONS } from './landingAnchors'

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
    const links = await screen.findAllByRole('link', { name: 'Open chats' })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute('href', '/chats')
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

describe('HomePage sections', () => {
  it('has Features, How it works, Built with and a closing call to action', async () => {
    mockFetch(401, { error: 'unauthorized' })
    renderWithProviders(<HomePage />)

    for (const name of ['Features', 'How it works', 'Built with', 'Have something to say?']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 3, name: 'Delete for me' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google?next=%2Fchats',
    )
    expect(screen.getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/tosrv/personal-messenger',
    )
  })
})

describe('landing anchors', () => {
  it('every navbar anchor points at a section on the page', () => {
    mockFetch(401, { error: 'unauthorized' })
    const { container } = renderWithProviders(<HomePage />)
    for (const { id } of [...LANDING_SECTIONS, { id: 'home' }]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull()
    }
  })
})

describe('landing navbar', () => {
  it('has the brand (back to top), anchors to each section and sign in', async () => {
    mockFetch(401, { error: 'unauthorized' })
    renderWithProviders(<HomePage />)

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const anchors = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('#'))
      .map((a) => [a.textContent, a.getAttribute('href')])
    expect(anchors).toEqual([
      ['Messenger', '#home'], // brand scrolls back to the top
      ['Features', '#features'],
      ['How it works', '#how'],
      ['Built with', '#stack'],
    ])
    expect(within(nav).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google?next=%2Fchats',
    )
    // Sticky inside the page's own scroll area, so it lines up with the page frame.
    expect(nav.closest('header')).toHaveClass('sticky')
  })
})
