/**
 * Returns `next` only if it is a same-app path, otherwise `fallback`.
 * Prevents open redirects via ?next=https://evil.com or //evil.com (PRD 6.8).
 */
export function safeRedirect(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback
  }
  return next
}
