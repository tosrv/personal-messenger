import { UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useGuestSignIn } from './api'
import { GUEST_RETENTION_NOTE } from './guestPolicy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      <Label htmlFor="guest-name" className="sr-only">
        Your name
      </Label>
      <div className="mt-3 flex gap-2">
        <Input
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
          className="flex-1"
        />
        <Button type="submit" variant="outline" disabled={!canSubmit}>
          <UserRound className="size-4" aria-hidden />
          {guest.isPending ? 'Starting…' : 'Start chat'}
        </Button>
      </div>
      {guest.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {guest.error.message}
        </p>
      )}
    </form>
  )
}
