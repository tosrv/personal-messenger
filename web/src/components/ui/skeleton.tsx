import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// shadcn/ui Skeleton.
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-surface motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
