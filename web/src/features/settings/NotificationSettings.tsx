import { useState, type ReactNode } from 'react'
import { playChime } from '../notifications/notify'
import {
  readNotificationPrefs,
  systemNotificationsSupported,
  writeNotificationPrefs,
  type NotificationPrefs,
} from '../notifications/prefs'
import { SettingsPanel } from './SettingsPanel'
import { Label } from '@/components/ui/label'

/** In-app notification preferences (ADR 0010). Saved on this device only. */
export function NotificationSettings() {
  const [prefs, setPrefs] = useState(readNotificationPrefs)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    systemNotificationsSupported() ? Notification.permission : 'unsupported',
  )

  const update = (next: NotificationPrefs) => {
    writeNotificationPrefs(next)
    setPrefs(next)
  }

  const toggleDesktop = async (on: boolean) => {
    if (!on || permission === 'unsupported') {
      update({ ...prefs, desktop: false })
      return
    }
    // The browser asks once; afterwards the answer is remembered.
    const answer = permission === 'granted' ? 'granted' : await Notification.requestPermission()
    setPermission(answer)
    update({ ...prefs, desktop: answer === 'granted' })
  }

  return (
    <SettingsPanel
      title="Notifications"
      description="Shown while Personal Messenger is open in a tab. Saved on this device."
    >
      <div className="space-y-5">
        <Toggle
          id="notify-sound"
          label="Sound"
          checked={prefs.sound}
          onChange={(on) => {
            update({ ...prefs, sound: on })
            if (on) playChime() // let the user hear what they turned on
          }}
        >
          Play a short chime when a message arrives, unless you are looking at that chat.
        </Toggle>

        <Toggle
          id="notify-desktop"
          label="System notifications"
          checked={prefs.desktop && permission === 'granted'}
          disabled={permission === 'unsupported' || permission === 'denied'}
          onChange={(on) => void toggleDesktop(on)}
        >
          {permission === 'unsupported'
            ? 'This browser does not support system notifications.'
            : permission === 'denied'
              ? 'Notifications are blocked for this site. Allow them in your browser settings, then come back here.'
              : 'Show a notification with the sender and the start of the message while this tab is in the background. Anyone who can see your screen can read it.'}
        </Toggle>
      </div>
    </SettingsPanel>
  )
}

function Toggle({
  id,
  label,
  checked,
  disabled,
  onChange,
  children,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-hint`}
        className="mt-1 size-4 accent-accent"
      />
      <div>
        <Label htmlFor={id} className="block">
          {label}
        </Label>
        <p id={`${id}-hint`} className="text-sm text-muted">
          {children}
        </p>
      </div>
    </div>
  )
}
