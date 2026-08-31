/**
 * Styled wrappers over the `cmdk` command-menu primitive.
 *
 * Same spirit as `ui/collapsible.tsx`: this mirrors the shadcn/ui `Command`
 * pattern but keeps our own file and DragonFable `@theme` tokens, and adds no
 * clsx/cva/tailwind-merge layer. `cmdk` provides the accessible listbox
 * semantics, keyboard navigation, and (via its bundled Radix Dialog) the modal
 * focus trap for `CommandDialog`.
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'

function join(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function Command({ className, ...props }: ComponentPropsWithoutRef<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={join('flex h-full w-full flex-col overflow-hidden', className)}
      {...props}
    />
  )
}

interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  label?: string
  shouldFilter?: boolean
  children: ReactNode
}

export function CommandDialog({
  open,
  onOpenChange,
  label = 'Search',
  shouldFilter = false,
  children,
}: CommandDialogProps) {
  return (
    <CommandPrimitive.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={label}
      shouldFilter={shouldFilter}
      overlayClassName="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      contentClassName="img-fade fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border-default bg-bg-elevated shadow-prominent"
    >
      {children}
    </CommandPrimitive.Dialog>
  )
}

export function CommandInput({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border-default px-3">
      <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
      <CommandPrimitive.Input
        className={join(
          'flex h-12 w-full bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-muted',
          className
        )}
        {...props}
      />
    </div>
  )
}

export function CommandList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={join('max-h-[60vh] overflow-y-auto overflow-x-hidden p-1', className)}
      {...props}
    />
  )
}

export function CommandEmpty(props: ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className="py-8 text-center text-sm text-text-muted"
      {...props}
    />
  )
}

export function CommandGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={join(
        'overflow-hidden p-1 text-text-primary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted',
        className
      )}
      {...props}
    />
  )
}

export function CommandItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={join(
        'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-text-secondary outline-none data-[selected=true]:bg-bg-overlay data-[selected=true]:text-text-primary',
        className
      )}
      {...props}
    />
  )
}
