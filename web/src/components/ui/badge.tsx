import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// shadcn/ui Badge, mapped onto the app's semantic colors (src/index.css).
const badgeVariants = cva(
  'inline-flex shrink-0 items-center rounded-full border font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent text-accent-fg',
        outline: 'border-line text-muted',
      },
      size: {
        default: 'px-2 py-0.5 text-xs',
        xs: 'px-1.5 py-px text-[10px] tracking-wide uppercase',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Badge({
  className,
  variant,
  size,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge }
