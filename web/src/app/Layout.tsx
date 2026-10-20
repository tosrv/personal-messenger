import { NavLink, Outlet } from 'react-router-dom'
import { UserMenu } from '../features/auth/UserMenu'
import { ConnectionBanner } from '../features/realtime/ConnectionBanner'
import { RealtimeProvider } from '../features/realtime/RealtimeProvider'

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2 py-1 text-sm ${isActive ? 'font-medium text-fg' : 'text-muted hover:text-fg'}`

export function Layout() {
  return (
    <RealtimeProvider>
      {/* Fixed-height shell: pages scroll inside <main>, so the chat view can fill it. */}
      <div className="flex h-dvh flex-col">
        <header className="border-b border-line">
          <nav className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:gap-4">
            <NavLink to="/" className="mr-auto font-semibold">
              Messenger
            </NavLink>
            <NavLink to="/search" className={navLink}>
              Search
            </NavLink>
            <NavLink to="/chats" className={navLink}>
              Chats
            </NavLink>
            <UserMenu />
          </nav>
        </header>
        <div className="relative min-h-0 flex-1">
          <ConnectionBanner />
          <main className="h-full overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </RealtimeProvider>
  )
}
