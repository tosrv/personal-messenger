import { badgeTitle, preview, shouldNotify } from './notify'
import { readNotificationPrefs, writeNotificationPrefs } from './prefs'

describe('badgeTitle', () => {
  it('prefixes the unread count, capped at 99+', () => {
    expect(badgeTitle(0)).toBe('Personal Messenger')
    expect(badgeTitle(3)).toBe('(3) Personal Messenger')
    expect(badgeTitle(250)).toBe('(99+) Personal Messenger')
  })
})

describe('preview', () => {
  it('flattens whitespace and truncates long messages', () => {
    expect(preview('  hello\n\nthere  ')).toBe('hello there')
    const long = preview('x'.repeat(300))
    expect(long).toHaveLength(100)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('shouldNotify', () => {
  const m = { sender_id: 2, conversation_id: 7 }

  it('never notifies for your own messages', () => {
    expect(
      shouldNotify({ ...m, sender_id: 1 }, { myId: 1, openConversationId: null, visible: false }),
    ).toBe(false)
  })

  it('stays quiet only when you are looking at that chat', () => {
    expect(shouldNotify(m, { myId: 1, openConversationId: 7, visible: true })).toBe(false)
    expect(shouldNotify(m, { myId: 1, openConversationId: 7, visible: false })).toBe(true)
    expect(shouldNotify(m, { myId: 1, openConversationId: 8, visible: true })).toBe(true)
    expect(shouldNotify(m, { myId: 1, openConversationId: null, visible: true })).toBe(true)
  })
})

describe('notification prefs', () => {
  afterEach(() => localStorage.clear())

  it('are off by default and survive a round trip', () => {
    expect(readNotificationPrefs()).toEqual({ sound: false, desktop: false })
    writeNotificationPrefs({ sound: true, desktop: false })
    expect(readNotificationPrefs()).toEqual({ sound: true, desktop: false })
  })

  it('ignore corrupt values', () => {
    localStorage.setItem('pm-notifications', '{"sound":"yes","desktop":1}')
    expect(readNotificationPrefs()).toEqual({ sound: false, desktop: false })
    localStorage.setItem('pm-notifications', 'not json')
    expect(readNotificationPrefs()).toEqual({ sound: false, desktop: false })
  })
})
