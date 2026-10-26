import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { mockApi } from '../../test/mockApi'
import { AppearanceSettings } from './AppearanceSettings'
import { LanguageSettings } from './LanguageSettings'
import { ProfileSettings } from './ProfileSettings'
import { SettingsLayout } from './SettingsLayout'
import { SignOutSettings } from './SignOutSettings'

const me = { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@x.com' }

function renderSettings(path = '/settings') {
  const router = createMemoryRouter(
    [
      {
        path: '/settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <ProfileSettings /> },
          { path: 'profile', element: <ProfileSettings /> },
          { path: 'appearance', element: <AppearanceSettings /> },
          { path: 'language', element: <LanguageSettings /> },
          { path: 'sign-out', element: <SignOutSettings /> },
        ],
      },
      { path: '/', element: <p>home page</p> },
    ],
    { initialEntries: [path] },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('SettingsLayout', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme
    localStorage.clear()
  })

  it('lists Profile, Appearance, Language and Sign out, and opens Profile by default', async () => {
    mockApi({ 'GET /me': () => [200, me] })
    renderSettings()

    const menu = screen.getByRole('navigation', { name: 'Settings' })
    const names = within(menu)
      .getAllByRole('link')
      .map((a) => a.textContent)
    expect(names).toEqual(['Profile', 'Appearance', 'Language', 'Sign out'])
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Tomy')
  })

  it('navigates between sections from the menu', async () => {
    mockApi({ 'GET /me': () => [200, me] })
    const router = renderSettings()
    const menu = screen.getByRole('navigation', { name: 'Settings' })

    await userEvent.click(within(menu).getByRole('link', { name: 'Appearance' }))
    expect(await screen.findByRole('heading', { name: 'Appearance' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings/appearance')

    await userEvent.click(within(menu).getByRole('link', { name: 'Language' }))
    expect(await screen.findByRole('heading', { name: 'Language' })).toBeInTheDocument()
  })

  it('applies and remembers the theme', async () => {
    mockApi({ 'GET /me': () => [200, me] })
    renderSettings('/settings/appearance')

    expect(await screen.findByRole('radio', { name: /System/ })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: /Dark/ }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('pm-theme')).toBe('dark')

    await userEvent.click(screen.getByRole('radio', { name: /System/ }))
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('pm-theme')).toBeNull()
  })

  it('shows English as the only available language for now', async () => {
    mockApi({ 'GET /me': () => [200, me] })
    renderSettings('/settings/language')
    const list = await screen.findByRole('list', { name: 'Languages' })
    expect(
      within(list).getByText('English', { selector: '[lang="en"]' }).closest('li'),
    ).toHaveAttribute('aria-current', 'true')
    expect(
      within(list)
        .getByText(/coming soon/)
        .closest('li'),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('collapses the menu to icons that keep their names', async () => {
    mockApi({ 'GET /me': () => [200, me] })
    renderSettings()

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    const menu = screen.getByRole('navigation', { name: 'Settings' })
    const appearance = within(menu).getByRole('link', { name: 'Appearance' })
    expect(appearance).toHaveAttribute('title', 'Appearance')
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument()
    expect(localStorage.getItem('pm-sidebar-settings')).toBe('collapsed')

    await userEvent.click(appearance)
    expect(await screen.findByRole('heading', { name: 'Appearance' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('signs out from its own section', async () => {
    let signedOut = false
    mockApi({
      'GET /me': () => (signedOut ? [401, { error: 'unauthorized' }] : [200, me]),
      'POST /auth/logout': () => {
        signedOut = true
        return [204]
      },
    })
    renderSettings('/settings/sign-out')

    const panel = await screen.findByRole('region', { name: 'Sign out' })
    expect(await within(panel).findByText('@tomy')).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Sign out' }))

    expect(signedOut).toBe(true)
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })
})
