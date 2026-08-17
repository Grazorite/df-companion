/**
 * AccessPills — reusable DA Required / DC / DM pill tags
 *
 * Used on pet detail pages, badge detail pages, and any future section
 * where items have access requirements.
 *
 * DA Required: links to filter by DA access
 * DC: links to filter by DC access
 * DM: links to filter by Defender's Medal access
 */
import { Link } from 'react-router-dom'
import { accessPillClass } from '../../utils/accessPillStyles'
import { buildFilterLink } from '../../utils/filterLinks'

interface AccessPillsProps {
  daRequired: boolean
  dcRequired?: boolean // true if DC tag in forum post
  dmRequired?: boolean // true if DM tag in forum post
  /** Base path for the filter link — e.g. "/pets" or "/badges" */
  filterBase?: string
}

export default function AccessPills({
  daRequired,
  dcRequired = false,
  dmRequired = false,
  filterBase = '/pets',
}: AccessPillsProps) {
  if (!daRequired && !dcRequired && !dmRequired) return null

  return (
    <>
      {daRequired && (
        <Link
          to={buildFilterLink(filterBase, 'access', 'da')}
          className={`inline-flex items-center transition-colors hover:bg-orange-500/30 ${accessPillClass('da', 'detail')}`}
          title="Filter: DA Required"
          onClick={(e) => e.stopPropagation()}
        >
          DA Required
        </Link>
      )}
      {dcRequired && (
        <Link
          to={buildFilterLink(filterBase, 'access', 'dc')}
          className={`inline-flex items-center transition-colors hover:bg-amber-500/30 ${accessPillClass('dc', 'detail')}`}
          title="Filter: Dragon Coins required"
          onClick={(e) => e.stopPropagation()}
        >
          DC
        </Link>
      )}
      {dmRequired && (
        <Link
          to={buildFilterLink(filterBase, 'access', 'dm')}
          className={`inline-flex items-center transition-colors hover:bg-slate-500/30 ${accessPillClass('dm', 'detail')}`}
          title="Filter: Defender's Medals required"
          onClick={(e) => e.stopPropagation()}
        >
          DM
        </Link>
      )}
    </>
  )
}
