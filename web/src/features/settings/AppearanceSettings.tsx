import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useThemePreference, type ThemePreference } from '../../lib/theme'
import { SettingsPanel } from './SettingsPanel'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const options: { value: ThemePreference; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', hint: 'Match your device setting', icon: Monitor },
  { value: 'light', label: 'Light', hint: 'Always light', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always dark', icon: Moon },
]

export function AppearanceSettings() {
  const [theme, setTheme] = useThemePreference()

  return (
    <SettingsPanel title="Appearance" description="Saved on this device.">
      <h3 id="theme-label" className="text-sm font-medium">
        Theme
      </h3>
      <RadioGroup
        aria-labelledby="theme-label"
        value={theme}
        onValueChange={(v) => setTheme(v as ThemePreference)}
        className="mt-2 sm:grid-cols-3"
      >
        {options.map(({ value, label, hint, icon: Icon }) => (
          <RadioGroupItem
            key={value}
            value={value}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-3 text-left hover:bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-surface"
          >
            <Icon className="size-5 text-muted" aria-hidden />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </SettingsPanel>
  )
}
