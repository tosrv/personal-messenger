import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// shadcn/ui Input, mapped onto the app's semantic colors (src/index.css).
function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'w-full min-w-0 rounded-lg border border-line bg-transparent px-3 py-2 outline-none placeholder:text-muted focus:border-accent disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
