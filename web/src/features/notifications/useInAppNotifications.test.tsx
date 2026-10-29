import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { mockApi } from '../../test/mockApi'
import type { Message } from '../chat/api'
import { writeNotificationPrefs } from './prefs'
import { useInAppNotifications } from './useInAppNotifications'

const conversation = {
  id: 7,
  peer: { id: 2, username: 'alice', display_name: 'Alice' },
  last_message: null,
  unread_count: 3,
  last_read_message_id: 0,
  peer_last_read_message_id: 0,
  created_at: '2026-10-20T08:00:00Z',
}
const message: Message = {
  id: 11,
  conversation_id: 7,
  sender_id: 2,
  client_message_id: 'c-11',
  body: 'Are you there?',
  created_at: '2026-10-20T08:01:00Z',
}

class FakeNotification {
  static permission: NotificationPermission = 'granted'
  static created: FakeNotification[] = []
  onclick: (() => void) | null = null
  title: string
  options: NotificationOptions
  constructor(title: string, options: NotificationOptions) {
    this.title = title
    this.options = options
    FakeNotification.created.push(this)
  }
  close() {}
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

function setup(myId: number | undefined) {
  mockApi({ 'GET /conversations': () => [200, { conversations: [conversation] }] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/settings']}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook(() => useInAppNotifications(myId), { wrapper })
}

describe('useInAppNotifications', () => {
  beforeEach(() => {
    FakeNotification.created = []
    vi.stubGlobal('Notification', FakeNotification)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    setVisibility('visible')
    document.title = 'Personal Messenger'
  })

  it('puts the unread count in the tab title', async () => {
    setup(1)
    await waitFor(() => expect(document.title).toBe('(3) Personal Messenger'))
  })

  it('leaves the title alone when signed out', () => {
    setup(undefined)
    expect(document.title).toBe('Personal Messenger')
  })

  it('shows a system notification while the tab is hidden, if enabled', async () => {
    writeNotificationPrefs({ sound: false, desktop: true })
    const { result } = setup(1)
    await waitFor(() => expect(document.title).toBe('(3) Personal Messenger'))

    setVisibility('hidden')
    result.current(message)
    result.current({ ...message, sender_id: 1 }) // own message: never

    expect(FakeNotification.created).toHaveLength(1)
    expect(FakeNotification.created[0].title).toBe('Alice')
    expect(FakeNotification.created[0].options).toMatchObject({
      body: 'Are you there?',
      tag: 'conversation-7',
    })
  })

  it('shows nothing while visible, when disabled, or without permission', async () => {
    const { result } = setup(1)
    await waitFor(() => expect(document.title).toBe('(3) Personal Messenger'))

    writeNotificationPrefs({ sound: false, desktop: true })
    result.current(message) // tab visible
    setVisibility('hidden')
    writeNotificationPrefs({ sound: false, desktop: false })
    result.current(message) // disabled
    writeNotificationPrefs({ sound: false, desktop: true })
    FakeNotification.permission = 'denied'
    result.current(message) // no permission
    FakeNotification.permission = 'granted'

    expect(FakeNotification.created).toHaveLength(0)
  })
})
