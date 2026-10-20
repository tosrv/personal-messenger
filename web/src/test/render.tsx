import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * Renders ui at `path` inside a fresh QueryClient (no retries) and router.
 * `route` may carry history state, e.g. { pathname: "/chats", state: {...} }.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    path = '/',
    route = '/',
  }: { path?: string; route?: string | { pathname: string; state?: unknown } } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<p>other page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}
