import { cva } from 'class-variance-authority'

// shadcn/ui Button variants, mapped onto the app's semantic colors (src/index.css).
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[color,background-color,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-fg hover:opacity-90',
        destructive: 'bg-danger text-white hover:opacity-90',
        outline: 'border border-line hover:bg-surface',
        ghost: 'hover:bg-surface',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-3 py-1.5 text-sm',
        icon: 'size-10 rounded-full',
        'icon-sm': 'size-8 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)
