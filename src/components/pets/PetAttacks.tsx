import { useState } from 'react'
import { ChevronDown, ChevronUp, ImageOff } from 'lucide-react'
import type { Attack } from '../../types/pet'
import NotesList from '../shared/NotesList'

interface PetAttacksProps {
  attacks: Attack[]
}

function AttackImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div className="flex items-center gap-1.5 text-text-muted text-xs bg-bg-elevated border border-border-default rounded px-2 py-1.5">
        <ImageOff className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Image unavailable</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className="max-w-full rounded border border-border-default"
    />
  )
}

function AttackCard({ attack, index }: { attack: Attack; index: number }) {
  const [open, setOpen] = useState(index === 0)

  return (
    <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-elevated transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-text-primary">{attack.name}</span>
        {open ? <ChevronUp className="w-4 h-4 text-text-muted flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-default pt-3">
          <p className="text-text-secondary text-sm leading-relaxed">{attack.description}</p>

          {attack.notes && attack.notes.length > 0 && (
            <NotesList notes={attack.notes.join('\n')} />
          )}

          {attack.images && attack.images.length > 0 && (
            <div className="space-y-2">
              {attack.images.map((src, i) => (
                <AttackImage key={i} src={src} alt={`${attack.name} animation ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PetAttacks({ attacks }: PetAttacksProps) {
  if (attacks.length === 0) return null

  return (
    <section aria-labelledby="attacks-heading" className="mb-5">
      <h2 id="attacks-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Attacks
      </h2>
      <div className="space-y-2">
        {attacks.map((attack, i) => (
          <AttackCard key={attack.name} attack={attack} index={i} />
        ))}
      </div>
    </section>
  )
}
