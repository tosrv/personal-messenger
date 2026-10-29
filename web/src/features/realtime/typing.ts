import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

/** At most one "typing" frame per conversation this often (ADR 0009). */
export const TYPING_THROTTLE_MS = 3_000
/** How long "typing…" stays visible after the last event. */
export const TYPING_TIMEOUT_MS = 6_000

type Typing = {
  /** conversation id → id of the user typing in it */
  typing: ReadonlyMap<number, number>
  /** Call while the user types; throttled before anything is sent. */
  notifyTyping: (conversationId: number) => void
  /** Call after sending a message, so the next keystroke signals again. */
  resetTyping: (conversationId: number) => void
}

export const TypingContext = createContext<Typing>({
  typing: new Map(),
  notifyTyping: () => {},
  resetTyping: () => {},
})

export function useIsTyping(conversationId: number) {
  return useContext(TypingContext).typing.has(conversationId)
}

export function useTypingSignal() {
  const { notifyTyping, resetTyping } = useContext(TypingContext)
  return { notifyTyping, resetTyping }
}

/**
 * Wraps `send` so it fires at most once per `intervalMs` per conversation.
 * A send that fails (offline) is not counted, so the next keystroke retries.
 */
export function createTypingThrottle(
  send: (conversationId: number) => boolean,
  intervalMs = TYPING_THROTTLE_MS,
  now = Date.now,
) {
  const last = new Map<number, number>()
  return {
    notify(conversationId: number) {
      const t = now()
      const prev = last.get(conversationId)
      if (prev !== undefined && t - prev < intervalMs) return
      if (send(conversationId)) last.set(conversationId, t)
    },
    reset(conversationId: number) {
      last.delete(conversationId)
    },
  }
}

/**
 * Who is typing where, fed by "typing" and "message.new" events. An entry
 * expires TYPING_TIMEOUT_MS after its last event, or as soon as that user's
 * message arrives.
 */
export function useTypingState() {
  const [typing, setTyping] = useState<ReadonlyMap<number, number>>(new Map())
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const stop = useCallback((conversationId: number, userId?: number) => {
    setTyping((prev) => {
      if (!prev.has(conversationId)) return prev
      if (userId !== undefined && prev.get(conversationId) !== userId) return prev
      clearTimeout(timers.current.get(conversationId))
      timers.current.delete(conversationId)
      const next = new Map(prev)
      next.delete(conversationId)
      return next
    })
  }, [])

  const start = useCallback(
    (conversationId: number, userId: number) => {
      clearTimeout(timers.current.get(conversationId))
      timers.current.set(
        conversationId,
        setTimeout(() => stop(conversationId), TYPING_TIMEOUT_MS),
      )
      setTyping((prev) =>
        prev.get(conversationId) === userId ? prev : new Map(prev).set(conversationId, userId),
      )
    },
    [stop],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  return { typing, start, stop }
}
