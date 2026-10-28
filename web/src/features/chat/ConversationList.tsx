import { Avatar } from '../../components/Avatar'
import { GuestBadge } from '../../components/GuestBadge'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { formatShortTime } from '../../lib/time'
import { useMe } from '../auth/api'
import { useConversations } from './api'
import { Button } from '@/components/ui/button'
import { WithTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function ConversationList({
  selectedId,
  onSelect,
  compact = false,
}: {
  selectedId: number | null
  onSelect: (conversationId: number) => void
  /** Collapsed sidebar: avatars only, details in the tooltip. */
  compact?: boolean
}) {
  const me = useMe()
  const conversations = useConversations()

  if (conversations.isPending) return compact ? null : <LoadingState />
  if (conversations.isError) {
    return <ErrorState error={conversations.error} onRetry={() => conversations.refetch()} />
  }
  if (conversations.data.length === 0) {
    if (compact) return null
    return (
      <EmptyState>
        No conversations yet.
        <br />
        Search for someone above to start chatting.
      </EmptyState>
    )
  }

  if (compact) {
    return (
      <ul className="flex flex-col items-center gap-1 py-1" aria-label="Conversations">
        {conversations.data.map((c) => {
          const selected = c.id === selectedId
          const label = c.unread_count
            ? `${c.peer.display_name}, ${c.unread_count} unread`
            : c.peer.display_name
          return (
            <li key={c.id}>
              <WithTooltip label={label} side="right">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onSelect(c.id)}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={label}
                  className={cn(
                    'relative size-auto rounded-full p-1',
                    selected && 'bg-surface ring-2 ring-accent',
                  )}
                >
                  <Avatar name={c.peer.display_name} src={c.peer.avatar_url} />
                  {c.unread_count > 0 && (
                    <span
                      aria-hidden
                      className="absolute top-0.5 right-0.5 size-3 rounded-full bg-accent ring-2 ring-bg"
                    />
                  )}
                </Button>
              </WithTooltip>
            </li>
          )
        })}
      </ul>
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
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">{c.peer.display_name}</span>
                    {c.peer.is_guest && <GuestBadge />}
                  </span>
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
