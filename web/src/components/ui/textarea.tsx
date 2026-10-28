import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// shadcn/ui Textarea, mapped onto the app's semantic colors (src/index.css).
function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'field-sizing-content w-full rounded-lg border border-line bg-transparent px-3 py-2 outline-none placeholder:text-muted focus:border-accent disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
