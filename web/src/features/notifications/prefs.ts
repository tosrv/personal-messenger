/**
 * In-app notification preferences (ADR 0010). Saved per device, like the
 * theme; both are off until the user turns them on.
 */
export type NotificationPrefs = {
  /** Play a short chime for new messages. */
  sound: boolean
  /** Show a system notification while the tab is hidden (needs permission). */
  desktop: boolean
}

const STORAGE_KEY = 'pm-notifications'
const DEFAULTS: NotificationPrefs = { sound: false, desktop: false }

export function readNotificationPrefs(): NotificationPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as unknown
    if (saved && typeof saved === 'object') {
      const { sound, desktop } = saved as Partial<NotificationPrefs>
      return { sound: sound === true, desktop: desktop === true }
    }
  } catch {
    // Blocked or corrupt storage: fall back to the defaults.
  }
  return DEFAULTS
}

export function writeNotificationPrefs(prefs: NotificationPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
}

/** Whether this browser has the Notification API at all. */
export function systemNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}
