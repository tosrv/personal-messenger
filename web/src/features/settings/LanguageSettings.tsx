import { Check } from 'lucide-react'
import { SettingsPanel } from './SettingsPanel'

// Only English exists today. Other languages are listed but disabled until
// their translations are added, so the setting never promises what it can't do.
const languages = [
  { code: 'en', name: 'English', native: 'English', available: true },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', available: false },
]

export function LanguageSettings() {
  return (
    <SettingsPanel title="Language" description="The language used for menus and messages.">
      <ul className="divide-y divide-line rounded-lg border border-line" aria-label="Languages">
        {languages.map((l) => (
          <li
            key={l.code}
            aria-current={l.code === 'en' ? 'true' : undefined}
            aria-disabled={!l.available || undefined}
            className={`flex items-center justify-between px-3 py-3 ${l.available ? '' : 'opacity-60'}`}
          >
            <span>
              <span className="block font-medium" lang={l.code}>
                {l.native}
              </span>
              <span className="block text-xs text-muted">
                {l.available ? l.name : `${l.name} · coming soon`}
              </span>
            </span>
            {l.code === 'en' && <Check className="size-5 text-accent" aria-label="Selected" />}
          </li>
        ))}
      </ul>
    </SettingsPanel>
  )
}
