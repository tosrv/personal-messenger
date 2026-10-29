import { act, renderHook } from '@testing-library/react'
import {
  createTypingThrottle,
  TYPING_THROTTLE_MS,
  TYPING_TIMEOUT_MS,
  useTypingState,
} from './typing'

describe('createTypingThrottle', () => {
  it('sends at most once per interval per conversation', () => {
    let now = 0
    const sent: number[] = []
    const t = createTypingThrottle(
      (id) => {
        sent.push(id)
        return true
      },
      TYPING_THROTTLE_MS,
      () => now,
    )
    t.notify(7)
    t.notify(7)
    t.notify(8) // another conversation has its own clock
    now = TYPING_THROTTLE_MS - 1
    t.notify(7)
    now = TYPING_THROTTLE_MS
    t.notify(7)
    expect(sent).toEqual([7, 8, 7])
  })

  it('retries on the next keystroke when sending failed, and after reset', () => {
    let online = false
    const sent: number[] = []
    const t = createTypingThrottle(
      (id) => {
        if (online) sent.push(id)
        return online
      },
      TYPING_THROTTLE_MS,
      () => 0,
    )
    t.notify(7)
    online = true
    t.notify(7)
    t.notify(7)
    t.reset(7)
    t.notify(7)
    expect(sent).toEqual([7, 7])
  })
})

describe('useTypingState', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('expires after the timeout, extended by each new event', () => {
    const { result } = renderHook(() => useTypingState())
    act(() => result.current.start(7, 2))
    expect(result.current.typing.get(7)).toBe(2)

    act(() => vi.advanceTimersByTime(TYPING_TIMEOUT_MS - 1000))
    act(() => result.current.start(7, 2))
    act(() => vi.advanceTimersByTime(TYPING_TIMEOUT_MS - 1))
    expect(result.current.typing.has(7)).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.typing.has(7)).toBe(false)
  })

  it("is cleared by that user's message, not by someone else's", () => {
    const { result } = renderHook(() => useTypingState())
    act(() => result.current.start(7, 2))
    act(() => result.current.stop(7, 1))
    expect(result.current.typing.has(7)).toBe(true)
    act(() => result.current.stop(7, 2))
    expect(result.current.typing.has(7)).toBe(false)
  })
})
