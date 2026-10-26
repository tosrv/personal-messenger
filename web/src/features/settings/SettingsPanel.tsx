import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Right-hand pane of /settings, with a back link to the menu on phones. */
export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby="settings-panel-title" className="mx-auto max-w-xl px-4 py-6">
      <div className="flex items-center gap-2">
        <Link
          to="/settings"
          className="-ml-2 rounded-full p-2 text-muted hover:bg-surface hover:text-fg md:hidden"
          aria-label="Back to settings"
          title="Back to settings"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h2 id="settings-panel-title" className="text-xl font-semibold">
          {title}
        </h2>
      </div>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}
