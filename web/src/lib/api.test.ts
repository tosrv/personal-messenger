import { mockFetch } from '../test/render'
import { ApiError, api } from './api'

describe('api', () => {
  it('sends credentials and a JSON body without dropping caller headers', async () => {
    const fetchSpy = mockFetch(200, { ok: true })
    await api('/things', { method: 'POST', json: { a: 1 }, headers: { 'X-CSRF-Token': 't' } })

    const [url, init] = fetchSpy.mock.calls[0]
    const headers = init?.headers as Headers
    expect(url).toBe('/api/v1/things')
    expect(init?.credentials).toBe('include')
    expect(init?.body).toBe('{"a":1}')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-CSRF-Token')).toBe('t')
  })

  it('does not send Content-Type on GET', async () => {
    const fetchSpy = mockFetch(200, {})
    await api('/things')
    const headers = fetchSpy.mock.calls[0][1]!.headers as Headers
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('throws ApiError with server message and status', async () => {
    mockFetch(404, { error: 'not found' })
    await expect(api('/missing')).rejects.toMatchObject({ status: 404, message: 'not found' })
    await expect(api('/missing')).rejects.toBeInstanceOf(ApiError)
  })
})
