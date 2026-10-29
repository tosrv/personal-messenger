import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { ChatsPage } from '../features/chat/ChatsPage'
import { LegacyChatRedirect } from '../features/chat/LegacyChatRedirect'
import { CHATS_PATH } from '../features/chat/navigation'
import { AppearanceSettings } from '../features/settings/AppearanceSettings'
import { LanguageSettings } from '../features/settings/LanguageSettings'
import { NotificationSettings } from '../features/settings/NotificationSettings'
import { ProfileSettings } from '../features/settings/ProfileSettings'
import { SettingsLayout } from '../features/settings/SettingsLayout'
import { HomeRoute } from '../features/system/HomeRoute'
import { ProfilePage } from '../features/users/ProfilePage'
import { Layout } from './Layout'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // Visitors see the landing page; signed-in users are sent to /chats.
      { path: '/', element: <HomeRoute /> },
      { path: '/login', element: <LoginPage /> },
      {
        // Everything below requires a session; visitors are sent to /login?next=…
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { path: '/u/:username', element: <ProfilePage /> },
          {
            path: '/settings',
            element: <SettingsLayout />,
            children: [
              // Wide screens show Profile next to the menu; phones show only the menu.
              { index: true, element: <ProfileSettings /> },
              { path: 'profile', element: <ProfileSettings /> },
              { path: 'notifications', element: <NotificationSettings /> },
              { path: 'appearance', element: <AppearanceSettings /> },
              { path: 'language', element: <LanguageSettings /> },
              { path: '*', element: <Navigate to="/settings" replace /> },
            ],
          },
          { path: CHATS_PATH, element: <ChatsPage /> },
          // Old addresses from before chats moved to a single page.
          { path: '/conversations', element: <Navigate to={CHATS_PATH} replace /> },
          { path: '/search', element: <Navigate to={CHATS_PATH} replace /> },
          { path: '/c/:id', element: <LegacyChatRedirect /> },
        ],
      },
      { path: '*', element: <p className="py-16 text-center text-muted">Page not found.</p> },
    ],
  },
])
