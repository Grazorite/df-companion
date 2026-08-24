import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { ClassAbilityEntry } from '../../types/classAbility'
import { isClassAbilityFamily } from '../../types/classAbility'
import { accessPillClass } from '../../utils/accessPillStyles'
import { CONSUMABLE_KIND_META, consumableKindPillClass } from '../../utils/classAbilityPills'
import { normalizeDescriptionText } from '../../utils/displayText'

interface ClassAbilityCardProps {
  item: ClassAbilityEntry
  toUrl?: string
}

export default function ClassAbilityCard({ item, toUrl }: ClassAbilityCardProps) {
  const isFamily = isClassAbilityFamily(item)
  const name = isFamily ? item.familyName : item.name
  const description = normalizeDescriptionText(isFamily ? item.shared.description : item.description)
  const route = `/classes/${item.slug}?type=${encodeURIComponent(item.subtype)}`
  const hasDA = isFamily ? item.hasDA : item.daRequired
  const hasDC = isFamily ? item.hasDC : item.dcRequired
  const hasDM = isFamily ? item.hasDM : item.dmRequired
  const consumableKinds = isFamily
    ? [
        item.consumableKind,
        ...item.levelVariants.map((variant) => variant.classAbilitySubtype),
      ].filter((kind): kind is keyof typeof CONSUMABLE_KIND_META =>
        Boolean(kind && kind in CONSUMABLE_KIND_META)
      )
    : item.consumableKind
      ? [item.consumableKind]
      : []
  const visibleConsumableKinds = [...new Set(consumableKinds)]

  return (
    <Link
      to={toUrl ?? route}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 h-[132px] transition-all duration-200 ease-out hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {hasDA && <span className={accessPillClass('da', 'card')}>DA</span>}
          {hasDC && <span className={accessPillClass('dc', 'card')}>DC</span>}
          {hasDM && <span className={accessPillClass('dm', 'card')}>DM</span>}
          {visibleConsumableKinds.map((kind) => (
            <span
              key={kind}
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${consumableKindPillClass(
                kind
              )}`}
              title={CONSUMABLE_KIND_META[kind].title}
            >
              {CONSUMABLE_KIND_META[kind].label}
            </span>
          ))}
          {item.isRare && (
            <span className="text-[10px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded-full font-medium">
              Rare
            </span>
          )}
        </div>

        <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1 line-clamp-1">
          {name}
        </h3>
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">
          {description || 'No description yet.'}
        </p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary flex-shrink-0 mt-0.5 transition-colors duration-150"
        aria-hidden="true"
      />
    </Link>
  )
}
