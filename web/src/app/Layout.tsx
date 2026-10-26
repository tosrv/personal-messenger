import { MessageCircle } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { NavIconLink } from '../components/NavIcon'
import { UserMenu } from '../features/auth/UserMenu'
import { CHATS_PATH } from '../features/chat/navigation'
import { ConnectionBanner } from '../features/realtime/ConnectionBanner'
import { RealtimeProvider } from '../features/realtime/RealtimeProvider'

export function Layout() {
  return (
    <RealtimeProvider>
      {/* Fixed-height shell: pages scroll inside <main>, so the chat view can fill it. */}
      <div className="flex h-dvh flex-col">
        <header className="border-b border-line">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 sm:gap-2"
          >
            <NavLink to="/" className="mr-auto font-semibold">
              Messenger
            </NavLink>
            <NavIconLink to={CHATS_PATH} label="Chats" icon={MessageCircle} />
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
