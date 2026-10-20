import { createBrowserRouter, Outlet } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { SettingsPage } from '../features/auth/SettingsPage'
import { ChatPage } from '../features/chat/ChatPage'
import { ConversationsPage } from '../features/chat/ConversationsPage'
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
          { path: '/conversations', element: <ConversationsPage /> },
          { path: '/c/:id', element: <ChatPage /> },
        ],
      },
      { path: '*', element: <p className="py-16 text-center text-muted">Page not found.</p> },
    ],
  },
])
