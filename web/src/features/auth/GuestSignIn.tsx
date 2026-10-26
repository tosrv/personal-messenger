import { UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useGuestSignIn } from './api'
import { GUEST_RETENTION_NOTE } from './guestPolicy'

const MAX_NAME = 50

/**
 * "Continue as guest" (ADR 0008): just a name, no Google account. Guests can
 * only chat with the owner, so the form says so and opens that chat.
 */
export function GuestSignIn({ ownerUsername }: { ownerUsername: string }) {
  const [name, setName] = useState('')
  const guest = useGuestSignIn(ownerUsername)
  const canSubmit = name.trim().length > 0 && !guest.isPending

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (canSubmit) guest.mutate(name)
  }

  return (
    <form onSubmit={submit} className="text-left" aria-labelledby="guest-title">
      <h2 id="guest-title" className="text-sm font-medium">
        Continue as guest
      </h2>
      <p className="text-sm text-muted">
        No account needed. You can message @{ownerUsername} only, and the chat stays in this
        browser. {GUEST_RETENTION_NOTE}
      </p>
      <label htmlFor="guest-name" className="sr-only">
        Your name
      </label>
      <div className="mt-3 flex gap-2">
        <input
          id="guest-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            guest.reset()
          }}
          maxLength={MAX_NAME}
          autoComplete="name"
          placeholder="Your name"
          required
          className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-2 outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 font-medium hover:bg-surface disabled:opacity-50"
        >
          <UserRound className="size-4" aria-hidden />
          {guest.isPending ? 'Starting…' : 'Start chat'}
        </button>
      </div>
      {guest.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {guest.error.message}
        </p>
      )}
    </form>
  )
}
