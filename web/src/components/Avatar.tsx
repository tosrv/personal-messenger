import { Avatar as AvatarRoot, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const sizes = { sm: 'size-7 text-xs', md: 'size-10 text-sm', lg: 'size-20 text-2xl' }

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string
  src?: string
  size?: keyof typeof sizes
}) {
  // A broken or slow image falls back to the initial instead of an empty circle.
  return (
    <AvatarRoot className={cn(sizes[size])}>
      {src && <AvatarImage src={src} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback aria-hidden delayMs={src ? 300 : 0}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </AvatarFallback>
    </AvatarRoot>
  )
}
