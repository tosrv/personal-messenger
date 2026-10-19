const sizes = { md: 'size-10 text-sm', lg: 'size-20 text-2xl' }

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string
  src?: string
  size?: keyof typeof sizes
}) {
  const cls = `${sizes[size]} shrink-0 rounded-full`
  if (src)
    return <img src={src} alt="" referrerPolicy="no-referrer" className={`${cls} object-cover`} />
  return (
    <span
      aria-hidden
      className={`${cls} flex items-center justify-center bg-accent/15 font-semibold text-accent`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
