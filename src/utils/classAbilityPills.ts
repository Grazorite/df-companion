import type { ConsumableKind } from '../types/classAbility'

export const CONSUMABLE_KIND_META: Record<
  ConsumableKind,
  { label: string; colour: string; title: string }
> = {
  dust: {
    label: 'Dust',
    colour: 'bg-violet-500/20 text-violet-200',
    title: 'Dust',
  },
  food: {
    label: 'Food',
    colour: 'bg-emerald-500/20 text-emerald-200',
    title: 'Food',
  },
  rune: {
    label: 'Rune',
    colour: 'bg-sky-500/20 text-sky-200',
    title: 'Rune',
  },
}

export function consumableKindPillClass(kind: ConsumableKind): string {
  return CONSUMABLE_KIND_META[kind].colour
}
