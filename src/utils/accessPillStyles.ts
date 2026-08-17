export const ACCESS_PILL_TONES = {
  da: 'bg-orange-500/20 text-orange-400',
  dc: 'bg-amber-500/20 text-gold',
  dm: 'bg-slate-500/20 text-slate-300',
} as const

export const ACCESS_PILL_SIZES = {
  card: 'text-[10px] px-1.5 py-0.5',
  detail: 'text-xs px-2.5 py-1',
  obtain: 'text-xs px-3 py-1',
  housingHeader: 'text-xs px-3 py-1.5',
} as const

export function accessPillClass(
  tone: keyof typeof ACCESS_PILL_TONES,
  size: keyof typeof ACCESS_PILL_SIZES,
  extra = ''
): string {
  return `${ACCESS_PILL_SIZES[size]} ${ACCESS_PILL_TONES[tone]} rounded-full font-medium ${extra}`.trim()
}
