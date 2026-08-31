/**
 * Token-styled wrappers over the Radix Tooltip primitive.
 *
 * Same approach as the other `ui/` primitives: mirrors shadcn/ui without
 * `shadcn init`, `components.json`, or clsx/cva. Radix supplies accessible
 * hover/focus behavior, `aria-describedby` wiring, Escape-to-dismiss, and
 * collision-aware positioning. Scope `TooltipProvider` close to where tooltips
 * are used (not at the app root) so `@radix-ui/react-tooltip` stays in the lazy
 * chunk of the consuming page rather than the main bundle.
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

function join(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

interface TooltipContentProps
  extends ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  children: ReactNode
}

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={join(
          'img-fade z-50 max-w-xs rounded-md border border-border-default bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary shadow-medium',
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
