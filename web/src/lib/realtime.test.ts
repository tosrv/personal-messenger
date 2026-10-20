import { backoffDelay, RealtimeClient, type ConnectionStatus } from './realtime'

/** Minimal controllable stand-in for the browser WebSocket. */
class FakeSocket {
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  closed = false
  serverSend(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
  drop() {
    this.onclose?.()
  }
  close() {
    this.closed = true
    this.onclose?.()
  }
}

function setup() {
  const sockets: FakeSocket[] = []
  const statuses: ConnectionStatus[] = []
  const events: unknown[] = []
  const onConnected = vi.fn()
  const client = new RealtimeClient({
    url: 'ws://test/ws',
    onEvent: (e) => events.push(e),
    onConnected,
    onStatus: (s) => statuses.push(s),
    createSocket: () => {
      const s = new FakeSocket()
      sockets.push(s)
      return s as unknown as WebSocket
    },
    random: () => 0.5,
  })
  return { client, sockets, statuses, events, onConnected }
}

describe('backoffDelay', () => {
  it('grows exponentially with jitter and is capped', () => {
    expect(backoffDelay(0, () => 0)).toBe(500)
    expect(backoffDelay(0, () => 1)).toBe(1000)
    expect(backoffDelay(3, () => 1)).toBe(8000)
    expect(backoffDelay(20, () => 1)).toBe(30000)
  })
})

describe('RealtimeClient', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('goes online on ready, forwards events, and resyncs after reconnect', () => {
    const { client, sockets, statuses, events, onConnected } = setup()
    client.start()
    expect(statuses).toEqual(['connecting'])

    sockets[0].serverSend({ type: 'ready' })
    expect(statuses.at(-1)).toBe('online')
    expect(onConnected).toHaveBeenCalledTimes(1)

    sockets[0].serverSend({ type: 'message.new', message: { id: 1 } })
    expect(events).toEqual([{ type: 'message.new', message: { id: 1 } }])

    sockets[0].drop()
    expect(statuses.at(-1)).toBe('offline')
    expect(sockets).toHaveLength(1)

    vi.advanceTimersByTime(750) // attempt 0 with random 0.5 → 750 ms
    expect(sockets).toHaveLength(2)
    sockets[1].serverSend({ type: 'ready' })
    expect(onConnected).toHaveBeenCalledTimes(2)
    client.stop()
  })

  it('backs off longer after repeated failures and resets after success', () => {
    const { client, sockets } = setup()
    client.start()
    sockets[0].drop()
    vi.advanceTimersByTime(750)
    sockets[1].drop()
    vi.advanceTimersByTime(1499) // attempt 1 → 1500 ms
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(3)

    sockets[2].serverSend({ type: 'ready' })
    sockets[2].drop()
    vi.advanceTimersByTime(750) // back to attempt 0
    expect(sockets).toHaveLength(4)
    client.stop()
  })

  it('reconnects immediately when the browser comes back online', () => {
    const { client, sockets } = setup()
    client.start()
    sockets[0].drop()
    window.dispatchEvent(new Event('online'))
    expect(sockets).toHaveLength(2)
    client.stop()
  })

  it('does not reconnect after stop', () => {
    const { client, sockets, statuses } = setup()
    client.start()
    client.stop()
    expect(sockets[0].closed).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(sockets).toHaveLength(1)
    expect(statuses).not.toContain('offline')
  })

  it('ignores malformed frames', () => {
    const { client, sockets, events } = setup()
    client.start()
    sockets[0].onmessage?.({ data: 'not json' })
    expect(events).toEqual([])
    client.stop()
  })
})
