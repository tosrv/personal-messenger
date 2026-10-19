import { createBrowserRouter } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
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
      // TODO(M2): wrap in RequireAuth once the backend requires a session for search.
      { path: '/search', element: <SearchPage /> },
      { path: '/u/:username', element: <ProfilePage /> },
      {
        path: '/conversations',
        element: (
          <RequireAuth>
            <p className="py-16 text-center text-muted">Conversations arrive in Milestone 3.</p>
          </RequireAuth>
        ),
      },
      { path: '*', element: <p className="py-16 text-center text-muted">Page not found.</p> },
    ],
  },
])
