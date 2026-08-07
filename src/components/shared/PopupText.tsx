import { normalizeDisplayText } from '../../utils/displayText'
import { splitPopupText, type PopupGroup } from '../../utils/popupText'

interface PopupTextProps {
  text: string
  as?: 'div' | 'p' | 'span'
  className?: string
  quoteClassName?: string
  showPopups?: boolean
}

interface BulletLine {
  text: string
  depth: number
}

function splitBulletText(text: string): { lead: string; bullets: BulletLine[] } {
  if (/\n\s*•\s+/.test(text)) {
    const leadLines: string[] = []
    const bullets: BulletLine[] = []

    for (const line of text.split('\n')) {
      const match = line.match(/^(\s*)•\s*(.*)$/)
      if (!match) {
        if (line.trim()) leadLines.push(line.trim())
        continue
      }

      bullets.push({
        text: match[2].trim(),
        depth: Math.max(0, Math.floor(match[1].length / 2)),
      })
    }

    return {
      lead: leadLines.join(' '),
      bullets,
    }
  }

  const parts = text
    .split(/\s+•\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return {
    lead: parts[0] ?? '',
    bullets: parts.slice(1).map((part) => ({ text: part, depth: 1 })),
  }
}

export default function PopupText({
  text,
  as: Component = 'p',
  className,
  quoteClassName,
  showPopups = true,
}: PopupTextProps) {
  const { mainText, popupGroups } = splitPopupText(text)
  const { lead, bullets } = splitBulletText(mainText)

  return (
    <>
      {lead && <Component className={className}>{normalizeDisplayText(lead)}</Component>}
      {bullets.length > 0 && (
        <ul className="mt-1 space-y-1">
          {bullets.map((bullet, index) => (
            <li
              key={index}
              className="flex gap-2 text-sm text-text-secondary leading-relaxed"
              style={{ marginLeft: `${Math.max(1, bullet.depth) * 1.25}rem` }}
            >
              <span className="text-text-muted mt-0.5 flex-shrink-0">
                {bullet.depth > 1 ? '◦' : '•'}
              </span>
              <span className="min-w-0 flex-1">{normalizeDisplayText(bullet.text)}</span>
            </li>
          ))}
        </ul>
      )}
      {showPopups && <PopupQuoteBlocks groups={popupGroups} className={quoteClassName} />}
    </>
  )
}

export function PopupQuoteBlocks({
  groups,
  className,
}: {
  groups: PopupGroup[]
  className?: string
}) {
  if (groups.length === 0) return null

  return (
    <>
      {groups.map((group, groupIndex) => (
        <div key={`${group.label}-${groupIndex}`} className={className}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {group.label}
          </p>
          <div className="rounded-md border border-border-default bg-bg-elevated px-3 py-2">
            <ul className="space-y-1">
              {group.messages.map((popup, index) => (
                <li key={index} className="text-sm text-text-secondary leading-relaxed italic">
                  {normalizeDisplayText(popup)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </>
  )
}
