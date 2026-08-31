/**
 * AccessPills — reusable DA Required / DC / DM pill tags
 *
 * Used on pet detail pages, badge detail pages, and any future section
 * where items have access requirements.
 *
 * DA Required: links to filter by DA access
 * DC: links to filter by DC access
 * DM: links to filter by Defender's Medal access
 *
 * Each pill carries a Radix Tooltip that spells out the abbreviation (DA/DC/DM
 * are jargon) accessibly — keyboard focus, Escape-to-dismiss, and
 * `aria-describedby` wiring, replacing the old non-accessible `title`. The
 * `TooltipProvider` is scoped here (not at the app root) so
 * `@radix-ui/react-tooltip` stays in the lazy detail-page chunks rather than the
 * main bundle. AccessPills renders only on detail pages, so the instance count
 * is small.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { accessPillClass } from '../../utils/accessPillStyles'
import { buildFilterLink } from '../../utils/filterLinks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface AccessPillsProps {
  daRequired: boolean
  dcRequired?: boolean // true if DC tag in forum post
  dmRequired?: boolean // true if DM tag in forum post
  /** Base path for the filter link — e.g. "/pets" or "/badges" */
  filterBase?: string
}

interface AccessPillProps {
  to: string
  className: string
  tooltip: string
  children: ReactNode
}

function AccessPill({ to, className, tooltip, children }: AccessPillProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          className={className}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </Link>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export default function AccessPills({
  daRequired,
  dcRequired = false,
  dmRequired = false,
  filterBase = '/pets',
}: AccessPillsProps) {
  if (!daRequired && !dcRequired && !dmRequired) return null

  return (
    <TooltipProvider delayDuration={200}>
      {daRequired && (
        <AccessPill
          to={buildFilterLink(filterBase, 'access', 'da')}
          className={`inline-flex items-center transition-colors hover:bg-orange-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${accessPillClass('da', 'detail')}`}
          tooltip="Requires a Dragon Amulet"
        >
          DA Required
        </AccessPill>
      )}
      {dcRequired && (
        <AccessPill
          to={buildFilterLink(filterBase, 'access', 'dc')}
          className={`inline-flex items-center transition-colors hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${accessPillClass('dc', 'detail')}`}
          tooltip="Purchasable with Dragon Coins"
        >
          DC
        </AccessPill>
      )}
      {dmRequired && (
        <AccessPill
          to={buildFilterLink(filterBase, 'access', 'dm')}
          className={`inline-flex items-center transition-colors hover:bg-slate-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${accessPillClass('dm', 'detail')}`}
          tooltip="Requires Defender's Medals"
        >
          DM
        </AccessPill>
      )}
    </TooltipProvider>
  )
}
