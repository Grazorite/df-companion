import { useState } from 'react'
import { ExternalLink, Shield, ImageOff } from 'lucide-react'
import type { Pet } from '../../types/pet'
import ElementPill from '../shared/ElementPill'
import AccessPills from '../shared/AccessPills'
import ObtainCard from '../shared/ObtainCard'
import StatBar from '../shared/StatBar'
import NotesList from '../shared/NotesList'
import PetAttacks from './PetAttacks'
import PetEvolutions from './PetEvolutions'
import PetCard from './PetCard'
import { useRelatedPets } from '../../hooks/usePets'

interface PetDetailProps {
  pet: Pet
  backUrl: string
}

function PetImage({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div className="w-full max-w-xs mx-auto aspect-square bg-bg-elevated border border-border-default rounded-xl flex flex-col items-center justify-center gap-2 text-text-muted">
        <ImageOff className="w-10 h-10" />
        <span className="text-xs">Image unavailable</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={`${name}`}
      loading="lazy"
      onError={() => setBroken(true)}
      className="max-w-xs w-full mx-auto rounded-xl border border-border-default shadow-medium img-fade"
    />
  )
}

export default function PetDetail({ pet, backUrl }: PetDetailProps) {
  const relatedPets = useRelatedPets(pet.alsoSee)
  const dcRequired = pet.dcRequired || pet.obtainMethods.some(m => m.priceType === 'dc')

  // Strip everything from "Thanks to" onwards — attribution lines, not content
  const cleanedNotes = pet.notes
    ? (() => {
        // Handle both newline-separated (new) and " • "-separated (legacy) formats
        const separator = pet.notes.includes('\n') ? '\n' : ' • '
        const bullets = pet.notes.split(separator)
        const cutoff = bullets.findIndex(n => /^Thanks\s+to\b/i.test(n.trim()))
        const kept = cutoff >= 0 ? bullets.slice(0, cutoff) : bullets
        const result = kept.filter(n => n.trim().length > 0).join(separator)
        return result || undefined
      })()
    : undefined

  const stats = [
    { label: 'Level', value: pet.level },
    { label: 'Damage', value: pet.damage },
    { label: 'Stats', value: pet.stats },
    { label: 'Resists', value: pet.resists },
    { label: 'Rarity', value: pet.rarity },
  ].filter(s => s.value && s.value !== 'Unknown' && s.value !== 'None' || s.label === 'Level')

  return (
    <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        {/* Meta pills */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {pet.elements.map(code => (
            <ElementPill key={code} code={code} size="md" clickable />
          ))}
          {pet.traits.map(code => (
            <ElementPill key={code} code={code} size="md" />
          ))}
          <AccessPills daRequired={pet.daRequired} dcRequired={dcRequired} filterBase="/pets" />
          <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-bg-overlay text-text-muted capitalize ml-auto">
            {pet.type}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2">{pet.name}</h1>
        <p className="text-text-secondary text-sm italic leading-relaxed mb-2">{pet.description}</p>

        {pet.releaseDate && pet.releaseDate !== 'Unknown' && (
          <p className="text-text-muted text-xs">Released: {pet.releaseDate}</p>
        )}
      </div>

      {/* Pet image */}
      {pet.imageUrl ? (
        <div className="mb-6">
          <PetImage src={pet.imageUrl} name={pet.name} />
        </div>
      ) : (
        <div className="mb-6 w-full max-w-xs mx-auto aspect-square bg-bg-elevated border border-border-default rounded-xl flex items-center justify-center">
          <Shield className="w-16 h-16 text-border-hover" aria-hidden="true" />
        </div>
      )}

      {/* Stats */}
      {stats.length > 0 && (
        <section aria-labelledby="stats-heading" className="mb-5">
          <h2 id="stats-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Stats
          </h2>
          <StatBar stats={stats} />
        </section>
      )}

      {/* How to Obtain */}
      {pet.obtainMethods.length > 0 && (
        <section aria-labelledby="obtain-heading" className="mb-5">
          <h2 id="obtain-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            How to Obtain
          </h2>
          <div className="space-y-2">
            {pet.obtainMethods.map((method, i) => (
              <ObtainCard
                key={i}
                method={method}
                index={pet.obtainMethods.length > 1 ? i : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Evolutions */}
      <PetEvolutions evolutions={pet.evolutions} fromUrl={backUrl} />

      {/* Attacks */}
      <PetAttacks attacks={pet.attacks} />

      {/* Notes */}
      {cleanedNotes && (
        <section className="bg-bg-surface/60 border border-border-default rounded-lg p-4 mb-5">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Other Information
          </h2>
          <NotesList notes={cleanedNotes} />
        </section>
      )}

      {/* Forum Source */}
      <section aria-labelledby="source-heading" className="mb-5">
        <h2 id="source-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Forum Source
        </h2>
        <a
          href={pet.forumUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between bg-gold/10 border-l-4 border-gold rounded-lg p-4 min-h-[56px] hover:bg-gold/15 transition-colors"
        >
          <div>
            <span className="text-gold text-xs font-medium block mb-0.5">Primary Source</span>
            <span className="text-text-primary text-sm font-medium">DF Encyclopedia: {pet.name}</span>
          </div>
          <ExternalLink className="w-4 h-4 text-text-muted flex-shrink-0 ml-3" aria-hidden="true" />
        </a>
      </section>

      {/* Tags */}
      {pet.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-8" aria-label="Tags">
          {pet.tags.map(tag => (
            <span key={tag} className="bg-bg-overlay text-text-muted text-xs px-2.5 py-1 rounded-full border border-border-subtle">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Also See — related pets from forum data */}
      {relatedPets.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border-default pt-6">
          <h2 id="related-heading" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Also See
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {relatedPets.map(related => {
              const section = related.type === 'pet' ? 'pets' : 'guests'
              return (
                <li key={related.id}>
                  <PetCard
                    pet={related}
                    toUrl={`/${section}/${related.slug}?from=${encodeURIComponent(backUrl)}`}
                    replace
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}
