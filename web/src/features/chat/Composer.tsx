import { SendHorizontal } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_MESSAGE_LENGTH } from './api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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
      <Label htmlFor="composer" className="sr-only">
        Message
      </Label>
      <Textarea
        id="composer"
        rows={1}
        value={body}
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Write a message"
        className="max-h-40 min-h-10 flex-1 resize-none rounded-none border-0 px-1"
      />
      {remaining < 200 && (
        <span className="pb-2 text-xs text-muted" aria-live="polite">
          {remaining}
        </span>
      )}
      <Button type="submit" size="icon" disabled={!canSend} aria-label="Send" title="Send (Enter)">
        <SendHorizontal className="size-5" aria-hidden />
      </Button>
    </form>
  )
}
