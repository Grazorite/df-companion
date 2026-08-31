/**
 * Thin wrappers over the Radix ToggleGroup primitive.
 *
 * Same approach as `ui/collapsible.tsx` and `ui/command.tsx`: mirrors the
 * shadcn/ui pattern without `shadcn init`, `components.json`, or
 * clsx/cva/tailwind-merge. Radix supplies group semantics, roving-tabindex
 * keyboard navigation (arrow keys move between items, one tab stop), and
 * per-item `data-state` / pressed wiring. Styling stays on the consumer using
 * the existing `@theme` tokens.
 */
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'

export const ToggleGroup = ToggleGroupPrimitive.Root

export const ToggleGroupItem = ToggleGroupPrimitive.Item
