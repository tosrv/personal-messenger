import { LogIn } from 'lucide-react'
import { googleLoginUrl } from '../auth/api'
import { LANDING_SECTIONS } from './landingAnchors'

/**
 * Navbar for the landing page (visitors only): anchors to each section and
 * a sign-in button. Framed like the page below it (same width, side rules).
 */
export function LandingNav() {
  return (
    <nav
      aria-label="Main"
      className="mx-auto flex max-w-7xl items-center gap-6 border-line px-6 py-2.5 md:border-x md:px-10"
    >
      {/* The brand doubles as "back to top" (the hero has id="home"). */}
      <a href="#home" title="Back to top" className="font-semibold">
        Messenger
      </a>

      <ul className="hidden items-center gap-1 sm:flex">
        {LANDING_SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>

      <a
        href={googleLoginUrl('/chats')}
        className="ml-auto inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
      >
        <LogIn className="size-4" aria-hidden />
        Sign in
      </a>
    </nav>
  )
}
