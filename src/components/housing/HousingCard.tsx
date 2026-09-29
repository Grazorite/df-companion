import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { HousingEntry } from '../../types/housing'
import { isHousingFamily } from '../../types/housing'
import { accessPillClass } from '../../utils/accessPillStyles'
import { normalizeDescriptionText } from '../../utils/displayText'
import { getFamilyCardDescription } from '../../utils/variantHelpers'

interface HousingCardProps {
  item: HousingEntry
  toUrl?: string
}

export default function HousingCard({ item, toUrl }: HousingCardProps) {
  const isFamily = isHousingFamily(item)
  const name = isFamily ? item.familyName : item.name
  const description = normalizeDescriptionText(
    isFamily ? getFamilyCardDescription(item) : item.description
  )
  const route = `/housing/${item.slug}?type=${encodeURIComponent(item.subtype)}`
  const dcRequired = isFamily ? item.hasDC : item.dcRequired
  const hasFree = isFamily ? item.hasFree : item.hasFree

  return (
    <Link
      to={toUrl ?? route}
      className="group flex items-start gap-3 bg-bg-surface border border-border-default rounded-lg p-4 h-[120px] transition-[transform,box-shadow,background-color,border-color] duration-[160ms] ease-[cubic-bezier(0.2,0,0,1)] hover:bg-bg-elevated hover:border-border-hover hover:-translate-y-0.5 hover:shadow-medium active:translate-y-0 active:scale-[0.99] active:duration-[90ms] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-bg-base"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {dcRequired && (
            <span className={accessPillClass('dc', 'card')}>
              DC
            </span>
          )}
          {hasFree && (
            <span className="text-[10px] text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded-full font-medium">
              Free
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
        className="w-4 h-4 text-text-muted group-hover:text-text-secondary group-hover:translate-x-0.5 flex-shrink-0 mt-0.5 transition-[color,transform] duration-[130ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:group-hover:translate-x-0"
        aria-hidden="true"
      />
    </Link>
  )
}
