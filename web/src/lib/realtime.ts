export type ConnectionStatus = 'connecting' | 'online' | 'offline'

export type ServerEvent = { type: string; [key: string]: unknown }

type Options = {
  url: string
  onEvent: (event: ServerEvent) => void
  /** Called after every successful (re)connect; use it to fetch missed data. */
  onConnected: () => void
  onStatus: (status: ConnectionStatus) => void
  /** Injectable for tests. */
  createSocket?: (url: string) => WebSocket
  random?: () => number
}

const MIN_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

/** Delay before reconnect attempt `n` (0-based): exponential, capped, with jitter. */
export function backoffDelay(attempt: number, random = Math.random): number {
  const base = Math.min(MAX_DELAY_MS, MIN_DELAY_MS * 2 ** attempt)
  return Math.round(base / 2 + (random() * base) / 2)
}

/**
 * A WebSocket that reconnects with exponential backoff (PRD §6.5).
 * Messages are sent over REST; the only client frame is the ephemeral
 * "typing" signal (ADR 0009), sent with `send`.
 */
export class RealtimeClient {
  private socket: WebSocket | null = null
  /** True between "ready" and the socket closing. */
  private ready = false
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private stopped = false
  private readonly opts: Options

  constructor(opts: Options) {
    this.opts = opts
  }

  start() {
    this.stopped = false
    window.addEventListener('online', this.reconnectNow)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.connect()
  }

  stop() {
    this.stopped = true
    clearTimeout(this.timer)
    window.removeEventListener('online', this.reconnectNow)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.socket?.close(1000)
    this.socket = null
    this.ready = false
  }

  /** Sends a frame if connected. Returns false (and drops it) otherwise. */
  send(frame: object): boolean {
    if (!this.socket || !this.ready) return false
    this.socket.send(JSON.stringify(frame))
    return true
  }

  private connect() {
    if (this.stopped) return
    clearTimeout(this.timer)
    this.opts.onStatus('connecting')
    const create = this.opts.createSocket ?? ((url) => new WebSocket(url))
    const socket = create(this.opts.url)
    this.socket = socket

    socket.onmessage = (e) => {
      let event: ServerEvent
      try {
        event = JSON.parse(String(e.data)) as ServerEvent
      } catch {
        return
      }
      if (event.type === 'ready') {
        this.ready = true
        this.attempt = 0
        this.opts.onStatus('online')
        this.opts.onConnected()
        return
      }
      this.opts.onEvent(event)
    }
    socket.onclose = () => {
      if (this.socket !== socket) return // superseded by a newer socket
      this.socket = null
      this.ready = false
      if (this.stopped) return
      this.opts.onStatus('offline')
      const delay = backoffDelay(this.attempt++, this.opts.random)
      this.timer = setTimeout(() => this.connect(), delay)
    }
    // onerror is always followed by onclose, which schedules the retry.
  }

  /** Skip the backoff wait, e.g. when the network or tab comes back. */
  private reconnectNow = () => {
    if (this.stopped || this.socket) return
    this.attempt = 0
    this.connect()
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.reconnectNow()
  }
}

export function websocketUrl(path = '/ws'): string {
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${path}`
}
