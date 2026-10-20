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
        className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
      />
      {remaining < 200 && (
        <span className="pb-2 text-xs text-muted" aria-live="polite">
          {remaining}
        </span>
      )}
      <button
        type="submit"
        disabled={!canSend}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
      >
        Send
      </button>
    </form>
  )
}
