import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { useMe } from '../features/auth/api'
import { UserMenu } from '../features/auth/UserMenu'
import { ConnectionBanner } from '../features/realtime/ConnectionBanner'
import { RealtimeProvider } from '../features/realtime/RealtimeProvider'

export function Layout() {
  const me = useMe()
  // "/" shows the landing page to visitors (signed-in users are redirected).
  const landing = useMatch('/') !== null && !me.data

  return (
    <RealtimeProvider>
      {/* Fixed-height shell: pages scroll inside <main>, so the chat view can fill it. */}
      <div className="flex h-dvh flex-col">
        {/* The landing page renders its own (sticky) navbar inside <main>, so it
            shares the page's width and its side rules line up with the page below. */}
        {!landing && (
          <header className="border-b border-line">
            <AppNav />
          </header>
        )}
        <div className="relative min-h-0 flex-1">
          <ConnectionBanner />
          <main className={`h-full overflow-y-auto ${landing ? 'motion-safe:scroll-smooth' : ''}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </RealtimeProvider>
  )
}

/** Navbar inside the app: the brand (→ "/", i.e. chats when signed in) and the avatar. */
function AppNav() {
  return (
    <nav
      aria-label="Main"
      className="mx-auto flex max-w-5xl items-center gap-1 border-line px-4 py-2 sm:gap-2 md:border-x"
    >
      <NavLink to="/" className="mr-auto font-semibold">
        Messenger
      </NavLink>
      <UserMenu />
    </nav>
  )
}
