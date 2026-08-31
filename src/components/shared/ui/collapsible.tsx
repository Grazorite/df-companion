/**
 * Thin wrappers over the Radix Collapsible primitive.
 *
 * This mirrors the shadcn/ui pattern (Collapsible / CollapsibleTrigger /
 * CollapsibleContent) but is deliberately NOT installed via `shadcn init`: we
 * keep our own file, our own `@theme` design tokens, and add no clsx/cva/
 * tailwind-merge layer. Radix supplies the accessibility (keyboard operation,
 * focus handling, `aria-controls` / `aria-expanded` wiring, `data-state`) and
 * the animatable `--radix-collapsible-content-height` CSS variable.
 */
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

export const Collapsible = CollapsiblePrimitive.Root

export const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

export const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent
