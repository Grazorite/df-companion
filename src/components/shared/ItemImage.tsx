import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'

interface ItemImageProps {
  src?: string
  alt: string
  showPlaceholder?: boolean
  className?: string
  placeholderLabel?: string
}

export default function ItemImage({
  src,
  alt,
  showPlaceholder = false,
  className = 'max-w-xs w-full mx-auto rounded-xl border border-border-default shadow-medium img-fade',
  placeholderLabel = 'Image unavailable',
}: ItemImageProps) {
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [src])

  if (!src || broken) {
    if (!showPlaceholder) return null

    return (
      <div className="max-w-xs w-full mx-auto rounded-xl border border-dashed border-border-default bg-bg-surface px-6 py-10 text-center shadow-subtle">
        <ImageOff className="w-10 h-10 mx-auto mb-3 text-text-muted" aria-hidden="true" />
        <p className="text-sm font-medium text-text-secondary">{placeholderLabel}</p>
      </div>
    )
  }

  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={className} />
  )
}
