import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readNotificationPrefs } from '../notifications/prefs'
import { renderWithProviders } from '../../test/render'
import { NotificationSettings } from './NotificationSettings'

function stubNotification(permission: NotificationPermission, answer: NotificationPermission) {
  const requestPermission = vi.fn(async () => answer)
  vi.stubGlobal('Notification', { permission, requestPermission })
  return requestPermission
}

describe('NotificationSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('saves the sound preference on this device', async () => {
    stubNotification('default', 'default')
    renderWithProviders(<NotificationSettings />)
    const sound = screen.getByRole('checkbox', { name: 'Sound' })
    expect(sound).not.toBeChecked()

    await userEvent.click(sound)

    expect(sound).toBeChecked()
    expect(readNotificationPrefs().sound).toBe(true)
  })

  it('asks the browser for permission before enabling system notifications', async () => {
    const requestPermission = stubNotification('default', 'granted')
    renderWithProviders(<NotificationSettings />)
    const desktop = screen.getByRole('checkbox', { name: 'System notifications' })

    await userEvent.click(desktop)

    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(desktop).toBeChecked()
    expect(readNotificationPrefs().desktop).toBe(true)
  })

  it('stays off when the user refuses permission', async () => {
    stubNotification('default', 'denied')
    renderWithProviders(<NotificationSettings />)
    const desktop = screen.getByRole('checkbox', { name: 'System notifications' })

    await userEvent.click(desktop)

    expect(desktop).not.toBeChecked()
    expect(desktop).toBeDisabled()
    expect(readNotificationPrefs().desktop).toBe(false)
    expect(screen.getByText(/blocked for this site/)).toBeInTheDocument()
  })
})
