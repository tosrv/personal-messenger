import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { mockFetch } from '../../test/render'
import { HomeRoute } from './HomeRoute'

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/chats" element={<p>chats page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HomeRoute', () => {
  it('shows the landing page to visitors', async () => {
    mockFetch(401, { error: 'unauthorized' })
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('A messenger')
  })

  it('sends signed-in users to their chats', async () => {
    mockFetch(200, { id: 1, username: 'tomy', display_name: 'Tomy', email: 't@x.com' })
    renderAt('/')
    expect(await screen.findByText('chats page')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })
})
