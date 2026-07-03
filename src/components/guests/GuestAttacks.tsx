import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { GuestAttack } from '../../types/pet'

interface GuestAttacksProps {
  attacks: GuestAttack[]
}

function AttackButton({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [broken, setBroken] = useState(false)
  
  if (!imageUrl || broken) {
    return (
      <div className="w-16 h-16 bg-bg-elevated border border-border-default rounded flex items-center justify-center">
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
      className="w-16 h-16 rounded border border-border-default shadow-subtle"
    />
  )
}

export default function GuestAttacks({ attacks }: GuestAttacksProps) {
  if (!attacks || attacks.length === 0) return null
  
  return (
    <section aria-labelledby="attacks-heading" className="mb-5">
      <h2 id="attacks-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Attacks ({attacks.length})
      </h2>
      <div className="space-y-3">
        {attacks.map((attack, index) => (
          <div
            key={index}
            className="bg-bg-surface border border-border-default rounded-lg p-4 hover:border-border-hover transition-colors"
          >
            <div className="flex gap-4">
              {/* Attack button image */}
              <div className="flex-shrink-0">
                <AttackButton imageUrl={attack.buttonImageUrl} name={attack.name} />
              </div>
              
              {/* Attack details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  {attack.name}
                </h3>
                <div className="text-xs text-text-secondary whitespace-pre-line leading-relaxed">
                  {attack.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
