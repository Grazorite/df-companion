import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Attack } from '../../types/pet'
import NotesList from '../shared/NotesList'
import PopupText from '../shared/PopupText'
import ExpandableImageList from '../shared/ExpandableImageList'
import MetricStrip from '../shared/MetricStrip'
import { extractRateFromEffect } from '../../utils/effectFormatting'

interface PetAttacksProps {
  attacks: Attack[]
}

function getAttackImageCaptions(attackName: string, imageCount: number): string[] | undefined {
  const match = attackName.match(/^Attack\s+Type\s+(.+)$/i)
  if (!match) return undefined

  const parts = match[1]
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length !== imageCount || parts.length <= 1) return undefined

  return parts.map((part) => `Attack Type ${part}`)
}

function AttackCard({ attack, index }: { attack: Attack; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const requirementsNote = attack.notes?.find((note) => note.startsWith('Requirements:'))
  const cooldownNote = attack.notes?.find((note) => note.startsWith('Cooldown:'))
  const extraNotes =
    attack.notes?.filter(
      (note) => !note.startsWith('Requirements:') && !note.startsWith('Cooldown:')
    ) ?? []
  const requirementsText = requirementsNote?.replace(/^Requirements:\s*/i, '').trim()
  const cooldownText = attack.cooldown ?? cooldownNote?.replace(/^Cooldown:\s*/i, '').trim()
  const { effectText, rate } = extractRateFromEffect(attack.description)
  const metrics = [
    ...(rate ? [{ label: 'Rate', value: rate }] : []),
    ...(cooldownText ? [{ label: 'Cooldown', value: cooldownText }] : []),
  ]

  return (
    <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-elevated transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-text-primary">
          {attack.name.replace(/^Attack\s+/i, '')}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-default pt-3">
          {requirementsText && requirementsText.toLowerCase() !== 'none' && (
            <p className="text-xs text-text-muted">
              <span className="font-medium">Requires:</span> {requirementsText}
            </p>
          )}

          {effectText && (
            <PopupText
              text={effectText}
              className="text-text-secondary text-sm leading-relaxed"
              quoteClassName="mt-2"
            />
          )}

          <MetricStrip metrics={metrics} />

          {extraNotes.length > 0 && <NotesList notes={extraNotes.join('\n')} />}

          {attack.images && attack.images.length > 0 && (
            <ExpandableImageList
              images={attack.images}
              captions={
                attack.imageCaptions ?? getAttackImageCaptions(attack.name, attack.images.length)
              }
              altPrefix={`${attack.name} animation`}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function PetAttacks({ attacks }: PetAttacksProps) {
  if (attacks.length === 0) return null

  const groupedAttacks = attacks.reduce<Array<{ heading?: string; attacks: Attack[] }>>(
    (groups, attack) => {
      const tierMatch = attack.name.match(/^(Tier\s+\d+):\s*(.+)$/i)
      const heading = tierMatch ? tierMatch[1] : undefined
      const normalizedAttack = tierMatch ? { ...attack, name: tierMatch[2] } : attack
      const lastGroup = groups[groups.length - 1]

      if (heading && lastGroup?.heading === heading) {
        lastGroup.attacks.push(normalizedAttack)
        return groups
      }

      groups.push({ ...(heading ? { heading } : {}), attacks: [normalizedAttack] })
      return groups
    },
    []
  )
  const attackCount = groupedAttacks.reduce((sum, group) => sum + group.attacks.length, 0)

  return (
    <section aria-labelledby="attacks-heading" className="mb-5">
      <h2
        id="attacks-heading"
        className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
      >
        {attackCount === 1 ? 'Attack' : `Attacks (${attackCount})`}
      </h2>
      <div className="space-y-4">
        {groupedAttacks.map((group, groupIndex) => (
          <div key={group.heading ?? `group-${groupIndex}`} className="space-y-2">
            {group.heading && (
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                {group.heading}
              </p>
            )}
            {group.attacks.map((attack, attackIndex) => (
              <AttackCard
                key={`${group.heading ?? 'base'}-${attack.name}-${attackIndex}`}
                attack={attack}
                index={groupIndex === 0 && attackIndex === 0 ? 0 : 1}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
