import { Badge } from '@/components/ui/badge'

/** Marks a guest account (no Google sign-in, ADR 0008) wherever a name is shown. */
export function GuestBadge() {
  return (
    <Badge variant="outline" size="xs">
      Guest
    </Badge>
  )
}
