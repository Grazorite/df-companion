/**
 * AccessPills — reusable DA Required / DC Required pill tags
 *
 * Used on pet detail pages, badge detail pages, and any future section
 * where items have access requirements.
 *
 * DA Required: links to filter by DA access
 * DC Required: links to filter by DC access (shown when an obtain method uses DC)
 */
import { Link } from 'react-router-dom'

interface AccessPillsProps {
  daRequired: boolean
  dcRequired?: boolean   // true if any obtain method uses priceType='dc'
  /** Base path for the filter link — e.g. "/pets" or "/badges" */
  filterBase?: string
}

export default function AccessPills({
  daRequired,
  dcRequired = false,
  filterBase = '/pets',
}: AccessPillsProps) {
  if (!daRequired && !dcRequired) return null

  return (
    <>
      {daRequired && (
        <Link
          to={`${filterBase}?access=da`}
          className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 transition-colors hover:bg-orange-500/30"
          title="Filter: DA Required"
          onClick={e => e.stopPropagation()}
        >
          DA Required
        </Link>
      )}
      {dcRequired && (
        <Link
          to={`${filterBase}?access=dc`}
          className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 transition-colors hover:bg-amber-500/30"
          title="Filter: Dragon Coins required"
          onClick={e => e.stopPropagation()}
        >
          DC Required
        </Link>
      )}
    </>
  )
}
