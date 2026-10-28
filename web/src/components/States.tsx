import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center text-muted">
      {/* The wrapper is the live region; the label stays for screen readers. */}
      <Spinner role="presentation" aria-label={undefined} aria-hidden className="size-6" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-muted">{children}</p>
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div role="alert" className="py-8 text-center">
      <p className="text-danger">{message}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      )}
    </div>
  )
}
