/** Marks a guest account (no Google sign-in, ADR 0008) wherever a name is shown. */
export function GuestBadge() {
  return (
    <span className="shrink-0 rounded-full border border-line px-1.5 py-px text-[10px] font-medium tracking-wide text-muted uppercase">
      Guest
    </span>
  )
}
