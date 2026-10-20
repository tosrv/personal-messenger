import { ChatPanel } from './ChatPanel'
import { ConversationList } from './ConversationList'
import { useCloseChat, useOpenChat, useOpenConversationId } from './navigation'

/**
 * WhatsApp Web–style chats: the list and the open chat side by side on wide
 * screens, one at a time on phones. The URL stays /chats either way.
 */
export function ChatsPage() {
  const openId = useOpenConversationId()
  const openChat = useOpenChat()
  const closeChat = useCloseChat()

  return (
    <div className="mx-auto flex h-full max-w-5xl md:border-x md:border-line">
      <aside
        className={`w-full shrink-0 overflow-y-auto md:w-80 md:border-r md:border-line ${
          openId ? 'hidden md:block' : ''
        }`}
      >
        <h1 className="px-3 pt-4 pb-2 text-xl font-semibold">Chats</h1>
        <ConversationList selectedId={openId} onSelect={openChat} />
      </aside>

      <div className={`min-w-0 flex-1 ${openId ? '' : 'hidden md:block'}`}>
        {openId ? (
          <ChatPanel conversationId={openId} onBack={closeChat} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-muted">
            Select a conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  )
}
