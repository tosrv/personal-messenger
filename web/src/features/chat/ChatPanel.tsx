import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { ErrorState, LoadingState } from '../../components/States'
import { ApiError } from '../../lib/api'
import { dayKey, formatDayLabel, formatTime } from '../../lib/time'
import { useMe } from '../auth/api'
import { useConversation, useMarkRead, useMessages, useSendMessage, type Message } from './api'
import { Composer } from './Composer'

/** A message the server has not confirmed yet (PRD §6.5). */
type Pending = {
  clientMessageId: string
  body: string
  status: 'sending' | 'failed'
  /** When the user pressed send (ISO), for the date separator. */
  createdAt: string
}

/** The right-hand pane of /chats: one conversation's messages and composer. */
export function ChatPanel({
  conversationId,
  onBack,
}: {
  conversationId: number
  onBack: () => void
}) {
  const conversation = useConversation(conversationId)

  if (conversation.isPending) return <LoadingState />
  if (conversation.isError) {
    if (conversation.error instanceof ApiError && conversation.error.status === 404) {
      return (
        <div className="py-16 text-center text-muted">
          <p>Conversation not found.</p>
          <button type="button" onClick={onBack} className="mt-3 text-accent hover:underline">
            Back to chats
          </button>
        </div>
      )
    }
    return <ErrorState error={conversation.error} onRetry={() => conversation.refetch()} />
  }

  const { peer } = conversation.data
  return (
    <section className="flex h-full flex-col" aria-label={`Chat with ${peer.display_name}`}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-2">
        {/* On wide screens the list stays visible, so "back" is only needed on phones. */}
        <button
          type="button"
          onClick={onBack}
          className="text-muted hover:text-fg md:hidden"
          aria-label="Back to chats"
        >
          ←
        </button>
        <Link to={`/u/${peer.username}`} className="flex items-center gap-2 hover:underline">
          <Avatar name={peer.display_name} src={peer.avatar_url} size="sm" />
          <span className="font-medium">{peer.display_name}</span>
        </Link>
      </header>
      {/* key: a different chat gets fresh pending/scroll state. */}
      <Thread
        key={conversationId}
        conversationId={conversationId}
        lastReadMessageId={conversation.data.last_read_message_id}
      />
    </section>
  )
}

function Thread({
  conversationId,
  lastReadMessageId,
}: {
  conversationId: number
  lastReadMessageId: number
}) {
  const me = useMe()
  const history = useMessages(conversationId)
  const send = useSendMessage(conversationId)
  const markRead = useMarkRead(conversationId)
  const [pending, setPending] = useState<Pending[]>([])

  const scroller = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const heightBeforeOlder = useRef<number | null>(null)

  const messages: Message[] = history.data
    ? history.data.pages.toReversed().flatMap((p) => p.messages)
    : []
  const newest = messages.at(-1)
  // A retried send may already be stored; show the server copy only.
  const confirmed = new Set(messages.map((m) => m.client_message_id))
  const visiblePending = pending.filter((p) => !confirmed.has(p.clientMessageId))

  // Keep the view pinned to the bottom for new messages, and keep the
  // reading position stable when older messages are prepended.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (heightBeforeOlder.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current
      heightBeforeOlder.current = null
    } else if (nearBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length, visiblePending.length])

  // Mark the newest message from the peer as read.
  const markReadMutate = markRead.mutate
  useEffect(() => {
    if (newest && newest.sender_id !== me.data?.id && newest.id > lastReadMessageId) {
      markReadMutate(newest.id)
    }
  }, [newest, me.data?.id, lastReadMessageId, markReadMutate])

  const deliver = (p: Pending) => {
    send.mutate(
      { clientMessageId: p.clientMessageId, body: p.body },
      {
        onSuccess: () =>
          setPending((list) => list.filter((x) => x.clientMessageId !== p.clientMessageId)),
        onError: () =>
          setPending((list) =>
            list.map((x) =>
              x.clientMessageId === p.clientMessageId ? { ...x, status: 'failed' } : x,
            ),
          ),
      },
    )
  }

  const onSend = (body: string) => {
    const p: Pending = {
      clientMessageId: crypto.randomUUID(),
      body,
      status: 'sending',
      createdAt: new Date().toISOString(),
    }
    nearBottom.current = true
    setPending((list) => [...list, p])
    deliver(p)
  }

  const retry = (p: Pending) => {
    setPending((list) =>
      list.map((x) => (x.clientMessageId === p.clientMessageId ? { ...x, status: 'sending' } : x)),
    )
    deliver({ ...p, status: 'sending' }) // same clientMessageId → no duplicate on the server
  }

  const loadOlder = () => {
    heightBeforeOlder.current = scroller.current?.scrollHeight ?? null
    void history.fetchNextPage()
  }

  return (
    <>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {history.isPending ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : (
          <>
            {history.hasNextPage && (
              <div className="mb-3 text-center">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={history.isFetchingNextPage}
                  className="rounded-lg border border-line px-3 py-1 text-sm text-muted hover:bg-surface disabled:opacity-50"
                >
                  {history.isFetchingNextPage ? 'Loading…' : 'Load older messages'}
                </button>
              </div>
            )}
            {messages.length === 0 && visiblePending.length === 0 && (
              <p className="py-8 text-center text-muted">No messages yet. Say hello!</p>
            )}
            <ol className="flex flex-col gap-1.5" aria-label="Messages">
              {messages.map((m, i) => (
                <Fragment key={m.id}>
                  {/* A new calendar day starts: "Today", "Yesterday", "Monday", "12 October"… */}
                  {(i === 0 || dayKey(m.created_at) !== dayKey(messages[i - 1].created_at)) && (
                    <DaySeparator iso={m.created_at} />
                  )}
                  <Bubble mine={m.sender_id === me.data?.id} body={m.body}>
                    {formatTime(m.created_at)}
                  </Bubble>
                </Fragment>
              ))}
              {/* Unconfirmed messages get a separator too if they start a new day. */}
              {visiblePending.length > 0 &&
                !sameDay(messages.at(-1)?.created_at, visiblePending[0].createdAt) && (
                  <DaySeparator iso={visiblePending[0].createdAt} />
                )}
              {visiblePending.map((p) => (
                <Bubble key={p.clientMessageId} mine body={p.body} faded={p.status === 'sending'}>
                  {p.status === 'sending' ? (
                    'Sending…'
                  ) : (
                    <span className="text-danger">
                      Not sent ·{' '}
                      <button type="button" onClick={() => retry(p)} className="underline">
                        Retry
                      </button>
                    </span>
                  )}
                </Bubble>
              ))}
            </ol>
          </>
        )}
      </div>
      <Composer onSend={onSend} />
    </>
  )
}

function sameDay(a: string | undefined, b: string): boolean {
  return a !== undefined && dayKey(a) === dayKey(b)
}

function DaySeparator({ iso }: { iso: string }) {
  return (
    <li className="sticky top-0 z-10 my-2 flex justify-center" role="separator">
      <span className="rounded-full border border-line bg-bg px-3 py-0.5 text-xs font-medium text-muted shadow-sm">
        <time dateTime={iso}>{formatDayLabel(iso)}</time>
      </span>
    </li>
  )
}

function Bubble({
  mine,
  body,
  faded,
  children,
}: {
  mine: boolean
  body: string
  faded?: boolean
  children: ReactNode
}) {
  return (
    <li className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <p
        className={`max-w-[80%] rounded-2xl px-3 py-1 wrap-break-word whitespace-pre-wrap ${
          mine ? 'bg-accent text-accent-fg' : 'bg-surface'
        } ${faded ? 'opacity-60' : ''}`}
      >
        {body}
      </p>
      <span className="mt-0.5 px-1 text-xs text-muted">{children}</span>
    </li>
  )
}
