import { LogOut } from 'lucide-react'
import { useLogout, useMe } from '../auth/api'
import { SettingsPanel } from './SettingsPanel'

export function SignOutSettings() {
  const me = useMe()
  const logout = useLogout()

  return (
    <SettingsPanel
      title="Sign out"
      description={
        <>
          You are signed in as <strong>@{me.data?.username}</strong> ({me.data?.email}). Signing out
          ends your session on this device. Your chats stay saved.
        </>
      }
    >
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 font-medium text-danger hover:bg-surface disabled:opacity-50"
      >
        <LogOut className="size-4" aria-hidden />
        {logout.isPending ? 'Signing out…' : 'Sign out'}
      </button>
      {logout.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {logout.error.message}
        </p>
      )}
    </SettingsPanel>
  )
}
