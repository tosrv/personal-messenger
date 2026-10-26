import { dayKey, formatDayLabel, formatShortTime } from './time'

// Local times, so the tests do not depend on the machine's time zone.
const now = new Date(2026, 9, 26, 9, 30) // Mon 26 Oct 2026, 09:30
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString()

describe('formatDayLabel', () => {
  it.each([
    ['earlier today', at(2026, 9, 26, 0), 'Today'],
    ['late yesterday (under 24 h ago)', at(2026, 9, 25, 23), 'Yesterday'],
    ['early yesterday', at(2026, 9, 25, 0), 'Yesterday'],
  ])('%s → %s', (_, iso, want) => {
    expect(formatDayLabel(iso, now)).toBe(want)
  })

  it('uses the weekday within the last week', () => {
    const iso = at(2026, 9, 21) // Wednesday
    expect(formatDayLabel(iso, now)).toBe(new Date(iso).toLocaleDateString([], { weekday: 'long' }))
  })

  it('uses the date for older messages, with the year only if different', () => {
    const thisYear = at(2026, 8, 3)
    const lastYear = at(2025, 11, 31)
    expect(formatDayLabel(thisYear, now)).toBe(
      new Date(thisYear).toLocaleDateString([], { day: 'numeric', month: 'long' }),
    )
    expect(formatDayLabel(lastYear, now)).toContain('2025')
  })
})

describe('formatShortTime', () => {
  it('shows Yesterday for the previous calendar day', () => {
    expect(formatShortTime(at(2026, 9, 25, 23), now)).toBe('Yesterday')
  })
})

describe('dayKey', () => {
  it('groups by local calendar day', () => {
    expect(dayKey(at(2026, 9, 25, 1))).toBe(dayKey(at(2026, 9, 25, 23)))
    expect(dayKey(at(2026, 9, 25, 23))).not.toBe(dayKey(at(2026, 9, 26, 0)))
  })
})
