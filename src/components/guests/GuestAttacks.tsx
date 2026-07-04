import { useState } from 'react'
import { ChevronDown, ImageOff } from 'lucide-react'
import type { GuestAttack } from '../../types/pet'

interface GuestAttacksProps {
  attacks: GuestAttack[]
}

function AttackButton({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [broken, setBroken] = useState(false)
  
  // "Attack" gets horizontal rectangle treatment, others get vertical
  const isAttackButton = name.toLowerCase() === 'attack'
  const sizeClasses = isAttackButton 
    ? 'w-24 h-16'  // Horizontal rectangle for "Attack"
    : 'w-16 h-20'  // Vertical rectangle for skill buttons
  
  if (!imageUrl || broken) {
    return (
      <div className={`${sizeClasses} bg-bg-elevated border border-border-default rounded flex items-center justify-center`}>
        <ImageOff className="w-6 h-6 text-text-muted" />
      </div>
    )
  }
  
  return (
    <img
      src={imageUrl}
      alt={`${name} button`}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`${sizeClasses} object-contain rounded border border-border-default shadow-subtle`}
    />
  )
}

function AttackCard({ attack, defaultOpen = false }: { attack: GuestAttack; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-bg-elevated/50 transition-colors"
        aria-expanded={isOpen}
      >
        {/* Attack button image */}
        <div className="flex-shrink-0">
          <AttackButton imageUrl={attack.buttonImageUrl} name={attack.name} />
        </div>
        
        {/* Attack name and description preview */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">
            {attack.name}
          </h3>
          {attack.description && (
            <p className="text-xs text-text-secondary italic mt-1 line-clamp-3 whitespace-pre-line break-words leading-relaxed">
              {attack.description}
            </p>
          )}
        </div>
        
        {/* Expand icon */}
        <ChevronDown
          className={`w-5 h-5 text-text-muted transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      
      {/* Expanded content */}
      {isOpen && (
        <div className="px-4 pb-4 pt-0 border-t border-border-default">
          {/* Requirements - only show if not "None" */}
          {attack.requirements && attack.requirements.toLowerCase() !== 'none' && (
            <p className="text-xs text-text-muted mt-3 mb-2">
              <span className="font-medium">Requires:</span> {attack.requirements}
            </p>
          )}
          
          {/* Effect - highlighted */}
          <p className="text-text-secondary text-sm leading-relaxed mt-3 mb-4 whitespace-pre-line">
            {attack.effect}
          </p>
          
          {/* Stats table */}
          <div className="grid grid-cols-4 gap-2 text-center bg-bg-base rounded-lg p-3">
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Mana</p>
              <p className="text-xs font-medium text-text-secondary">{attack.manaCost || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">CD</p>
              <p className="text-xs font-medium text-text-secondary">{attack.cooldown || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Type</p>
              <p className="text-xs font-medium text-text-secondary">{attack.damageType || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Element</p>
              <p className="text-xs font-medium text-text-secondary">{attack.element || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GuestAttacks({ attacks }: GuestAttacksProps) {
  if (!attacks || attacks.length === 0) return null
  
  // Filter out "Skip" attack
  const filteredAttacks = attacks.filter(a => a.name.toLowerCase() !== 'skip')
  
  if (filteredAttacks.length === 0) return null
  
  return (
    <section aria-labelledby="attacks-heading" className="mb-5">
      <h2 id="attacks-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Attacks ({filteredAttacks.length})
      </h2>
      <div className="space-y-3">
        {filteredAttacks.map((attack, index) => (
          <AttackCard key={index} attack={attack} defaultOpen={index === 0} />
        ))}
      </div>
    </section>
  )
}
