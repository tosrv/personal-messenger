export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { json?: unknown }

/**
 * Calls the backend under /api/v1 with the session cookie.
 * Pass `json` for a JSON body; non-2xx responses throw ApiError.
 */
export async function api<T>(path: string, { json, headers, ...init }: ApiInit = {}): Promise<T> {
  const h = new Headers(headers)
  h.set('Accept', 'application/json')
  if (json !== undefined) h.set('Content-Type', 'application/json')

  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    ...init,
    headers: h,
    body: json === undefined ? undefined : JSON.stringify(json),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(res.status, body.error ?? res.statusText)
  }
  // Some successful responses have no body (204, or e.g. 201 from /auth/guest).
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
