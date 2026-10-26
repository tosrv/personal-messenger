import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { meQueryKey, useMe, type Me } from '../auth/api'
import { SettingsPanel } from './SettingsPanel'

const USERNAME_PATTERN = '[a-zA-Z0-9_]{3,32}'
const MAX_DISPLAY_NAME_LENGTH = 50

type ProfileChanges = { username?: string; display_name?: string }

/** Mirrors the server: trim and collapse whitespace. */
const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ')

export function ProfileSettings() {
  const me = useMe()
  if (!me.data) return <LoadingState />
  return (
    <SettingsPanel
      title="Profile"
      description={
        me.data.is_guest ? (
          <>
            You are chatting as a guest. This account only works in this browser; signing out or
            clearing site data ends it.
          </>
        ) : (
          <>Signed in with Google as {me.data.email}. Your email is never shown to other users.</>
        )
      }
    >
      <ProfileForm me={me.data} />
    </SettingsPanel>
  )
}

function ProfileForm({ me }: { me: Me }) {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(me.display_name)
  const [username, setUsername] = useState(me.username)

  // Only send what changed, so an unchanged username is never re-validated.
  const changes: ProfileChanges = {}
  if (normalizeName(displayName) !== me.display_name) changes.display_name = displayName
  if (username.trim() !== me.username) changes.username = username.trim()
  const dirty = Object.keys(changes).length > 0

  const save = useMutation({
    mutationFn: (body: ProfileChanges) => api<Me>('/me', { method: 'PATCH', json: body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(meQueryKey, updated)
      setDisplayName(updated.display_name)
      setUsername(updated.username)
      // Your own profile page and search results may show the old name.
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (dirty) save.mutate(changes)
  }
  const edited = () => save.reset()

  const inputClass =
    'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent'

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={displayName || me.display_name} src={me.avatar_url} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">
            {normalizeName(displayName) || me.display_name}
          </p>
          <p className="truncate text-muted">@{username.trim() || me.username}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="display-name" className="block text-sm font-medium">
            Name
          </label>
          <p id="display-name-hint" className="text-sm text-muted">
            Shown on your profile and in chats. Up to {MAX_DISPLAY_NAME_LENGTH} characters.
          </p>
          <input
            id="display-name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value)
              edited()
            }}
            required
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            autoComplete="name"
            aria-describedby="display-name-hint"
            className={inputClass}
          />
        </div>

        {!me.is_guest && (
          <div>
            <label htmlFor="username" className="block text-sm font-medium">
              Username
            </label>
            <p id="username-hint" className="text-sm text-muted">
              3–32 letters, digits or underscores. Others find you and link to you with it.
            </p>
            <input
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                edited()
              }}
              required
              pattern={USERNAME_PATTERN}
              autoComplete="off"
              aria-describedby="username-hint"
              className={inputClass}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending || !dirty}
            className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
          <p role="status" aria-live="polite" className="text-sm">
            {save.isError && <span className="text-danger">{save.error.message}</span>}
            {save.isSuccess && <span className="text-ok">Profile saved.</span>}
          </p>
        </div>
      </form>
    </>
  )
}
