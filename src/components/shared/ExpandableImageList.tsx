import { useState } from 'react'
import { ChevronDown, ImageIcon, ImageOff } from 'lucide-react'

interface ExpandableImageListProps {
  images: string[]
  captions?: string[]
  label?: string
  altPrefix: string
}

function PreviewImage({ src, alt }: { src: string; alt: string }) {
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

export default function ExpandableImageList({
  images,
  captions,
  label = images.length === 1 ? 'Attack Image' : `Attack Images (${images.length})`,
  altPrefix,
}: ExpandableImageListProps) {
  const [open, setOpen] = useState(false)

  if (images.length === 0) return null

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
        aria-expanded={open}
      >
        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{open ? `Hide ${label}` : `Show ${label}`}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="space-y-2">
          {images.map((src, index) => (
            <figure key={`${src}-${index}`} className="space-y-1.5">
              {captions?.[index] && (
                <figcaption className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {captions[index]}
                </figcaption>
              )}
              <PreviewImage src={src} alt={`${altPrefix} ${index + 1}`} />
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
