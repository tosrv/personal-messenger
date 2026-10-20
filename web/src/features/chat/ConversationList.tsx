import { Link } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { formatShortTime } from '../../lib/time'
import { useMe } from '../auth/api'
import { useConversations } from './api'

export function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: number | null
  onSelect: (conversationId: number) => void
}) {
  const me = useMe()
  const conversations = useConversations()

  if (conversations.isPending) return <LoadingState />
  if (conversations.isError) {
    return <ErrorState error={conversations.error} onRetry={() => conversations.refetch()} />
  }
  if (conversations.data.length === 0) {
    return (
      <EmptyState>
        No conversations yet.{' '}
        <Link to="/search" className="text-accent hover:underline">
          Find someone to message
        </Link>
        .
      </EmptyState>
    )
  }

  return (
    <ul className="divide-y divide-line" aria-label="Conversations">
      {conversations.data.map((c) => {
        const mine = c.last_message?.sender_id === me.data?.id
        const selected = c.id === selectedId
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={selected ? 'true' : undefined}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface focus-visible:bg-surface ${
                selected ? 'bg-surface' : ''
              }`}
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
            </button>
          </li>
        )
      })}
    </ul>
  )
}
