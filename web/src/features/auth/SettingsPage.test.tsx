import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/render'
import { SettingsPage } from './SettingsPage'

const me = { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@example.com' }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status })
}

describe('SettingsPage', () => {
  it('shows the server error when the username is taken', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(200, me))
      .mockResolvedValueOnce(json(409, { error: 'conflict: username is already taken' }))
    renderWithProviders(<SettingsPage />)

    const input = await screen.findByLabelText('Username')
    await userEvent.clear(input)
    await userEvent.type(input, 'alice')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/already taken/)).toBeInTheDocument()
  })

  it('saves a new username with PATCH', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(200, me))
      .mockResolvedValueOnce(json(200, { ...me, username: 'tomy_2' }))
    renderWithProviders(<SettingsPage />)

    const input = await screen.findByLabelText('Username')
    await userEvent.clear(input)
    await userEvent.type(input, 'tomy_2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Username saved.')).toBeInTheDocument()
    const [url, init] = fetchSpy.mock.calls[1]
    expect(url).toBe('/api/v1/me/username')
    expect(init?.method).toBe('PATCH')
    expect(init?.body).toBe('{"username":"tomy_2"}')
  })
})
