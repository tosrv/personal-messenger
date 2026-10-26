import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useThemePreference, type ThemePreference } from '../../lib/theme'
import { SettingsPanel } from './SettingsPanel'

const options: { value: ThemePreference; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', hint: 'Match your device setting', icon: Monitor },
  { value: 'light', label: 'Light', hint: 'Always light', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always dark', icon: Moon },
]

export function AppearanceSettings() {
  const [theme, setTheme] = useThemePreference()

  return (
    <SettingsPanel title="Appearance" description="Saved on this device.">
      <fieldset>
        <legend className="text-sm font-medium">Theme</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {options.map(({ value, label, hint, icon: Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-3 hover:bg-surface has-checked:border-accent has-checked:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon className="size-5 text-muted" aria-hidden />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </SettingsPanel>
  )
}
