import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { MIN_QUERY_LEN, useUserSearch } from './api'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const search = useUserSearch(deferred)
  const tooShort = deferred.trim().replace(/^@/, '').length < MIN_QUERY_LEN

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold">Find people</h1>
      <label htmlFor="user-search" className="sr-only">
        Search by username
      </label>
      <input
        id="user-search"
        type="search"
        autoFocus
        autoComplete="off"
        maxLength={33}
        placeholder="Search by username"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
      />

      <div className="mt-4">
        {tooShort ? (
          <EmptyState>Type at least {MIN_QUERY_LEN} characters.</EmptyState>
        ) : search.isPending ? (
          <LoadingState />
        ) : search.isError ? (
          <ErrorState error={search.error} onRetry={() => search.refetch()} />
        ) : search.data.length === 0 ? (
          <EmptyState>No users found.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {search.data.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/u/${u.username}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface focus-visible:bg-surface"
                >
                  <Avatar name={u.display_name} src={u.avatar_url} />
                  <span>
                    <span className="block font-medium">{u.display_name}</span>
                    <span className="block text-sm text-muted">@{u.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
