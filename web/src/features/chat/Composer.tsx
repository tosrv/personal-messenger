import { SendHorizontal } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_MESSAGE_LENGTH } from './api'

/** Message input. Enter sends, Shift+Enter adds a new line. */
export function Composer({ onSend }: { onSend: (body: string) => void }) {
  const [body, setBody] = useState('')
  const remaining = MAX_MESSAGE_LENGTH - body.length
  const canSend = body.trim().length > 0 && remaining >= 0

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    onSend(body)
    setBody('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <textarea
        id="composer"
        rows={1}
        value={body}
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Write a message"
        className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 outline-none placeholder:text-muted"
      />
      {remaining < 200 && (
        <span className="pb-2 text-xs text-muted" aria-live="polite">
          {remaining}
        </span>
      )}
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send"
        title="Send (Enter)"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
      >
        <SendHorizontal className="size-5" aria-hidden />
      </button>
    </form>
  )
}
