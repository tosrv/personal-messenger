type Handler = (init: RequestInit | undefined, url: URL) => [status: number, body?: unknown]

/**
 * Routes fetch calls to handlers keyed by "METHOD /path" (path under /api/v1,
 * without query string). Unmatched calls fail the test loudly.
 */
export function mockApi(routes: Record<string, Handler>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const key = `${init?.method ?? 'GET'} ${url.pathname.replace('/api/v1', '')}`
    const handler = routes[key]
    if (!handler) throw new Error(`unmocked request: ${key}`)
    const [status, body] = handler(init, url)
    return new Response(body === undefined ? null : JSON.stringify(body), { status })
  })
}
