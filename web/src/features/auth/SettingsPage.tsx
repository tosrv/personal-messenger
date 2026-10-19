import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { meQueryKey, useMe, type Me } from './api'

const USERNAME_PATTERN = '[a-zA-Z0-9_]{3,32}'

export function SettingsPage() {
  const me = useMe()
  if (!me.data) return <LoadingState />
  return <UsernameForm me={me.data} />
}

function UsernameForm({ me }: { me: Me }) {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState(me.username)
  const save = useMutation({
    mutationFn: (value: string) =>
      api<Me>('/me/username', { method: 'PATCH', json: { username: value } }),
    onSuccess: (updated) => {
      queryClient.setQueryData(meQueryKey, updated)
      setUsername(updated.username)
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(username.trim())
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold">Account</h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as {me.display_name} ({me.email}). Your email is never shown to other users.
      </p>

      <form onSubmit={onSubmit} className="mt-6">
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <p id="username-hint" className="text-sm text-muted">
          3–32 letters, digits or underscores. Others find you and link to you with it.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            id="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              save.reset()
            }}
            required
            pattern={USERNAME_PATTERN}
            autoComplete="off"
            aria-describedby="username-hint"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={save.isPending || username.trim() === me.username}
            className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <p role="status" aria-live="polite" className="mt-2 min-h-6 text-sm">
          {save.isError && <span className="text-danger">{save.error.message}</span>}
          {save.isSuccess && <span className="text-ok">Username saved.</span>}
        </p>
      </form>
    </section>
  )
}
