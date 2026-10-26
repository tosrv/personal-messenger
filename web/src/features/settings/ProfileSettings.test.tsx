import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '../../test/mockApi'
import { renderWithProviders } from '../../test/render'
import { ProfileSettings } from './ProfileSettings'

const me = { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@example.com' }

/** Renders the page; PATCH /me answers with `respond(body)`. Returns sent bodies. */
function renderSettings(respond: (body: Record<string, string>) => [number, unknown]) {
  const patches: Record<string, string>[] = []
  mockApi({
    'GET /me': () => [200, me],
    'PATCH /me': (init) => {
      const body = JSON.parse(String(init?.body))
      patches.push(body)
      return respond(body)
    },
  })
  renderWithProviders(<ProfileSettings />)
  return patches
}

describe('ProfileSettings', () => {
  it('saves a new display name without resending the username', async () => {
    const patches = renderSettings((b) => [200, { ...me, ...b }])
    const name = await screen.findByLabelText('Name')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await userEvent.clear(name)
    await userEvent.type(name, 'Rahmat Tomy')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
    expect(patches).toEqual([{ display_name: 'Rahmat Tomy' }])
    expect(screen.getAllByText('Rahmat Tomy').length).toBeGreaterThan(0)
  })

  it('saves both fields in one request', async () => {
    const patches = renderSettings((b) => [200, { ...me, ...b }])
    await userEvent.clear(await screen.findByLabelText('Name'))
    await userEvent.type(screen.getByLabelText('Name'), 'Rahmat')
    await userEvent.clear(screen.getByLabelText('Username'))
    await userEvent.type(screen.getByLabelText('Username'), 'rahmat')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
    expect(patches).toEqual([{ display_name: 'Rahmat', username: 'rahmat' }])
  })

  it('shows the server error when the username is taken', async () => {
    renderSettings(() => [409, { error: 'conflict: username is already taken' }])
    const input = await screen.findByLabelText('Username')
    await userEvent.clear(input)
    await userEvent.type(input, 'alice')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/already taken/)).toBeInTheDocument()
  })

  it('treats whitespace-only edits to the name as unchanged', async () => {
    renderSettings((b) => [200, { ...me, ...b }])
    const name = await screen.findByLabelText('Name')
    await userEvent.type(name, '   ')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })
})
