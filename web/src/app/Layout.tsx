import { NavLink, Outlet } from 'react-router-dom'

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2 py-1 text-sm ${isActive ? 'font-medium text-fg' : 'text-muted hover:text-fg'}`

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="mr-auto font-semibold">
            Messenger
          </NavLink>
          <NavLink to="/search" className={navLink}>
            Search
          </NavLink>
          <NavLink to="/conversations" className={navLink}>
            Chats
          </NavLink>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
