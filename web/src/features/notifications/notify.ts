import type { Message } from '../chat/api'

export const BASE_TITLE = 'Personal Messenger'
const PREVIEW_LENGTH = 100

/** "(3) Personal Messenger" while there are unread messages. */
export function badgeTitle(unread: number, base = BASE_TITLE): string {
  if (unread <= 0) return base
  return `(${unread > 99 ? '99+' : unread}) ${base}`
}

/** The start of a message for a system notification. */
export function preview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat
}

/**
 * A message notifies unless the user sent it, or they are looking at that
 * chat right now (tab visible and the chat open).
 */
export function shouldNotify(
  m: Pick<Message, 'sender_id' | 'conversation_id'>,
  ctx: { myId: number | undefined; openConversationId: number | null; visible: boolean },
): boolean {
  if (m.sender_id === ctx.myId) return false
  return !(ctx.visible && ctx.openConversationId === m.conversation_id)
}

let audio: AudioContext | null = null

/** A short two-note chime, generated so no sound file is needed. */
export function playChime() {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    const gain = audio.createGain()
    gain.connect(audio.destination)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    for (const [freq, start] of [
      [880, 0],
      [1320, 0.12],
    ]) {
      const osc = audio.createOscillator()
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start(t + start)
      osc.stop(t + start + 0.2)
    }
  } catch {
    // No audio (blocked autoplay, old browser): stay silent.
  }
}
