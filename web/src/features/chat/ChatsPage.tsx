import { Search, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { SidebarToggle } from '../../components/SidebarToggle'
import { useSidebarCollapsed } from '../../lib/sidebar'
import { ChatPanel } from './ChatPanel'
import { ChatSearchResults } from './ChatSearchResults'
import { ConversationList } from './ConversationList'
import { useCloseChat, useOpenChat, useOpenConversationId } from './navigation'

/**
 * WhatsApp Web–style chats: the list and the open chat side by side on wide
 * screens, one at a time on phones. The URL stays /chats either way. The
 * search box above the list finds existing chats and new people. On wide
 * screens the list can be collapsed to a rail of avatars.
 */
export function ChatsPage() {
  const openId = useOpenConversationId()
  const openChat = useOpenChat()
  const closeChat = useCloseChat()
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const { collapsed, toggle } = useSidebarCollapsed('chats')
  const searchInput = useRef<HTMLInputElement>(null)

  // From the collapsed rail, the search icon expands the list and focuses the box.
  const expandAndSearch = () => {
    toggle()
    requestAnimationFrame(() => searchInput.current?.focus())
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl md:border-x md:border-line">
      <aside
        id="chats-sidebar"
        aria-label="Chat list"
        className={`flex w-full shrink-0 flex-col transition-[width] duration-200 motion-reduce:transition-none md:border-r md:border-line ${
          collapsed ? 'md:w-16' : 'md:w-80'
        } ${openId ? 'hidden md:flex' : ''}`}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 pt-3 pb-2">
            <SidebarToggle collapsed onToggle={toggle} controls="chats-sidebar" />
            <button
              type="button"
              onClick={expandAndSearch}
              aria-label="Search chats or people"
              title="Search chats or people"
              className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg"
            >
              <Search className="size-5" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="px-3 pt-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-semibold">Chats</h1>
              <SidebarToggle collapsed={false} onToggle={toggle} controls="chats-sidebar" />
            </div>
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <label htmlFor="chat-search" className="sr-only">
                Search chats or people
              </label>
              <input
                ref={searchInput}
                id="chat-search"
                type="search"
                autoComplete="off"
                maxLength={50}
                placeholder="Search or start a new chat"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                className="w-full rounded-full border border-line bg-surface py-2 pr-9 pl-9 text-sm outline-none focus:border-accent [&::-webkit-search-cancel-button]:hidden"
              />
              {searching && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  title="Clear search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-fg"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {searching && !collapsed ? (
            <ChatSearchResults query={query} onOpenChat={openChat} onPicked={() => setQuery('')} />
          ) : (
            <ConversationList selectedId={openId} onSelect={openChat} compact={collapsed} />
          )}
        </div>
      </aside>

      <div className={`min-w-0 flex-1 ${openId ? '' : 'hidden md:block'}`}>
        {openId ? (
          <ChatPanel conversationId={openId} onBack={closeChat} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-muted">
            Select a conversation, or search for someone to start chatting.
          </div>
        )}
      </div>
    </div>
  )
}
