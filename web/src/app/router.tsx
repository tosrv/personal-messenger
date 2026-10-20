import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { SettingsPage } from '../features/auth/SettingsPage'
import { ChatsPage } from '../features/chat/ChatsPage'
import { LegacyChatRedirect } from '../features/chat/LegacyChatRedirect'
import { CHATS_PATH } from '../features/chat/navigation'
import { HomePage } from '../features/system/HomePage'
import { ProfilePage } from '../features/users/ProfilePage'
import { SearchPage } from '../features/users/SearchPage'
import { Layout } from './Layout'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      {
        // Everything below requires a session; visitors are sent to /login?next=…
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { path: '/search', element: <SearchPage /> },
          { path: '/u/:username', element: <ProfilePage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: CHATS_PATH, element: <ChatsPage /> },
          // Old addresses from before chats moved to a single page.
          { path: '/conversations', element: <Navigate to={CHATS_PATH} replace /> },
          { path: '/c/:id', element: <LegacyChatRedirect /> },
        ],
      },
      { path: '*', element: <p className="py-16 text-center text-muted">Page not found.</p> },
    ],
  },
])
