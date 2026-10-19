import { Navigate, useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../components/States'
import { safeRedirect } from '../../lib/redirect'
import { googleLoginUrl, useMe } from './api'

const errorMessages: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  signin_failed: 'Sign-in failed. Please try again.',
}

export function LoginPage() {
  const [params] = useSearchParams()
  const next = safeRedirect(params.get('next'))
  const error = params.get('error')
  const me = useMe()

  if (me.isPending) return <LoadingState />
  if (me.data) return <Navigate to={next} replace />

  return (
    <section className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-muted">Use your Google account to start chatting.</p>
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
    </section>
  )
}
