import type { ReactNode } from 'react'
import { resolveFamilyNotes, cleanNotes } from '../../utils/notes'
import NotesList from './NotesList'

interface OtherInformationSectionProps {
  notes?: string
  sharedNotes?: string
  activeVariantNotes?: string
  allVariantNotes?: Array<string | undefined>
  showSharedNotes?: boolean
  className?: string
  panelClassName?: string
}

export default function OtherInformationSection({
  notes,
  sharedNotes,
  activeVariantNotes,
  allVariantNotes,
  showSharedNotes,
  className = 'mb-8',
  panelClassName = 'bg-bg-surface border border-border-default rounded-lg p-5',
}: OtherInformationSectionProps) {
  let content: ReactNode = null

  if (sharedNotes || activeVariantNotes || allVariantNotes) {
    const resolvedNotes = resolveFamilyNotes({
      sharedNotes,
      activeVariantNotes,
      allVariantNotes,
      showSharedNotes,
    })

    if (resolvedNotes.sharedNotes || resolvedNotes.variantNotes) {
      content = (
        <>
          {resolvedNotes.sharedNotes && <NotesList notes={resolvedNotes.sharedNotes} />}
          {resolvedNotes.sharedNotes && resolvedNotes.variantNotes && (
            <div className="my-3 border-t border-border-default" />
          )}
          {resolvedNotes.variantNotes && <NotesList notes={resolvedNotes.variantNotes} />}
        </>
      )
    }
  } else {
    const cleanedNotes = cleanNotes(notes)
    if (cleanedNotes) content = <NotesList notes={cleanedNotes} />
  }

  if (!content) return null

  return (
    <section className={className}>
      <div className={panelClassName}>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Other Information
        </h2>
        {content}
      </div>
    </section>
  )
}
