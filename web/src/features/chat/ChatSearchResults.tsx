import { useDeferredValue, type ReactNode } from 'react'
import { Avatar } from '../../components/Avatar'
import { ErrorState, LoadingState } from '../../components/States'
import { MIN_QUERY_LEN, useUserSearch } from '../users/api'
import { useConversations, useStartConversation } from './api'

// The server searches usernames only (letters, digits, underscore).
const USERNAME_QUERY = /^[a-zA-Z0-9_]+$/

/**
 * Results for the search box above the chat list: existing chats whose
 * name or username matches, then other people to start a new chat with.
 */
export function ChatSearchResults({
  query,
  onOpenChat,
  onPicked,
}: {
  query: string
  onOpenChat: (conversationId: number) => void
  /** Called after any result is chosen, e.g. to clear the search box. */
  onPicked: () => void
}) {
  const q = useDeferredValue(query.trim().replace(/^@/, ''))
  const needle = q.toLowerCase()

  const conversations = useConversations()
  const chats = (conversations.data ?? []).filter(
    (c) =>
      c.peer.display_name.toLowerCase().includes(needle) ||
      c.peer.username.toLowerCase().includes(needle),
  )

  const searchPeople = q.length >= MIN_QUERY_LEN && USERNAME_QUERY.test(q)
  const people = useUserSearch(searchPeople ? q : '')
  const inChats = new Set((conversations.data ?? []).map((c) => c.peer.id))
  const newPeople = (people.data ?? []).filter((u) => !inChats.has(u.id))

  const start = useStartConversation()

  const peopleSection = !searchPeople ? null : people.isPending ? (
    <LoadingState label="Searching…" />
  ) : people.isError ? (
    <ErrorState error={people.error} onRetry={() => people.refetch()} />
  ) : newPeople.length > 0 ? (
    <Section title="People">
      {newPeople.map((u) => (
        <Row
          key={u.id}
          name={u.display_name}
          avatar={u.avatar_url}
          detail={`@${u.username}`}
          disabled={start.isPending}
          onClick={() => start.mutate(u.username, { onSuccess: onPicked })}
        />
      ))}
    </Section>
  ) : null

  const nothing =
    chats.length === 0 && (!searchPeople || (people.isSuccess && newPeople.length === 0))

  return (
    <div>
      {chats.length > 0 && (
        <Section title="Chats">
          {chats.map((c) => (
            <Row
              key={c.id}
              name={c.peer.display_name}
              avatar={c.peer.avatar_url}
              detail={`@${c.peer.username}`}
              onClick={() => {
                onOpenChat(c.id)
                onPicked()
              }}
            />
          ))}
        </Section>
      )}
      {peopleSection}
      {nothing && (
        <p className="px-3 py-8 text-center text-sm text-muted">
          No chats or people found.
          {!searchPeople && q.length > 0 && (
            <>
              <br />
              To find new people, search by username (letters, digits, _).
            </>
          )}
        </p>
      )}
      {start.isError && (
        <p role="alert" className="px-3 py-2 text-sm text-danger">
          {start.error.message}
        </p>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="px-3 pt-3 pb-1 text-xs font-medium tracking-wide text-muted uppercase">
        {title}
      </h2>
      <ul>{children}</ul>
    </section>
  )
}

function Row({
  name,
  avatar,
  detail,
  onClick,
  disabled,
}: {
  name: string
  avatar?: string
  detail: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface focus-visible:bg-surface disabled:opacity-50"
      >
        <Avatar name={name} src={avatar} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{name}</span>
          <span className="block truncate text-sm text-muted">{detail}</span>
        </span>
      </button>
    </li>
  )
}
