import { Link } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { formatShortTime } from '../../lib/time'
import { useMe } from '../auth/api'
import { useConversations } from './api'

export function ConversationsPage() {
  const me = useMe()
  const conversations = useConversations()

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold">Chats</h1>
      <div className="mt-4">
        {conversations.isPending ? (
          <LoadingState />
        ) : conversations.isError ? (
          <ErrorState error={conversations.error} onRetry={() => conversations.refetch()} />
        ) : conversations.data.length === 0 ? (
          <EmptyState>
            No conversations yet.{' '}
            <Link to="/search" className="text-accent hover:underline">
              Find someone to message
            </Link>
            .
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {conversations.data.map((c) => {
              const mine = c.last_message?.sender_id === me.data?.id
              return (
                <li key={c.id}>
                  <Link
                    to={`/c/${c.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface focus-visible:bg-surface"
                  >
                    <Avatar name={c.peer.display_name} src={c.peer.avatar_url} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{c.peer.display_name}</span>
                        {c.last_message && (
                          <span className="shrink-0 text-xs text-muted">
                            {formatShortTime(c.last_message.created_at)}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm ${c.unread_count ? 'font-medium text-fg' : 'text-muted'}`}
                        >
                          {c.last_message
                            ? `${mine ? 'You: ' : ''}${c.last_message.body}`
                            : `@${c.peer.username}`}
                        </span>
                        {c.unread_count > 0 && (
                          <span
                            className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-fg"
                            aria-label={`${c.unread_count} unread`}
                          >
                            {c.unread_count > 99 ? '99+' : c.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
