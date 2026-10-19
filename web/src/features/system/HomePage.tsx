import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api<{ status: string }>('/health', { signal }),
  })
  const label = health.isPending ? 'checking…' : health.isError ? 'down' : 'ok'
  const color = health.isPending ? 'text-muted' : health.isError ? 'text-danger' : 'text-ok'

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Personal Messenger</h1>
      <p className="mt-2 text-muted">Self-hosted real-time messaging.</p>
      <p role="status" className={`mt-6 text-sm ${color}`}>
        API: {label}
      </p>
      <Link to="/search" className="mt-8 inline-block font-medium text-accent hover:underline">
        Find people →
      </Link>
    </section>
  )
}
