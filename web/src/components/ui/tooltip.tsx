import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// shadcn/ui Tooltip. Each Tooltip carries its own provider, so no app-level setup is needed.
function Tooltip({
  delayDuration = 300,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Root> & { delayDuration?: number }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipPrimitive.Provider>
  )
}

function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn('z-50 rounded-md bg-fg px-2 py-1 text-xs text-bg shadow-sm', className)}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

/** Wraps a single control (e.g. an icon button) with a text tooltip; `disabled` renders it bare. */
function WithTooltip({
  label,
  side,
  disabled,
  children,
}: {
  label: ReactNode
  side?: ComponentProps<typeof TooltipContent>['side']
  disabled?: boolean
  children: ReactNode
}) {
  if (disabled) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipContent, TooltipTrigger, WithTooltip }
