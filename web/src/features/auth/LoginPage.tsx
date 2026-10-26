import { Navigate, useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../components/States'
import { safeRedirect } from '../../lib/redirect'
import { googleLoginUrl, useAppConfig, useMe } from './api'
import { GuestSignIn } from './GuestSignIn'

const errorMessages: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  signin_failed: 'Sign-in failed. Please try again.',
}

export function LoginPage() {
  const [params] = useSearchParams()
  const next = safeRedirect(params.get('next'))
  const error = params.get('error')
  const me = useMe()
  const config = useAppConfig()

  if (me.isPending) return <LoadingState />
  if (me.data) return <Navigate to={next} replace />

  // Visitors from a "Chat with me" link (/u/<username>) see who they will reach.
  const target = /^\/u\/([A-Za-z0-9_]{3,32})$/.exec(next)?.[1]

  return (
    // Framed by the same side rules as the other pages; content centred both ways.
    <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center border-line px-4 py-16 md:border-x">
      <section className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold">
          {target ? `Sign in to chat with @${target}` : 'Sign in'}
        </h1>
        <p className="mt-2 text-muted">
          Use your Google account. No new password needed, and your email is never shown to other
          users.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-danger">
            {errorMessages[error] ?? errorMessages.signin_failed}
          </p>
        )}
        <a
          href={googleLoginUrl(next)}
          className="mt-8 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Continue with Google
        </a>

        {config.data?.guest_enabled && (
          <>
            <div className="my-8 flex items-center gap-3 text-xs text-muted" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <GuestSignIn ownerUsername={config.data.owner_username} />
          </>
        )}
      </section>
    </div>
  )
}
