import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'

interface ItemImageProps {
  src?: string
  alt: string
  showPlaceholder?: boolean
  className?: string
  placeholderLabel?: string
  /**
   * Marks this as the primary/above-the-fold detail image. When true, the image loads eagerly with
   * high fetch priority, its container reserves space so it does not shift layout as it decodes, and
   * it is tagged `data-primary-media` for the media-stability tests. Secondary/toggle images should
   * leave this false so they stay lazily loaded.
   */
  priority?: boolean
}

const DEFAULT_IMAGE_CLASS =
  'max-w-xs w-full mx-auto rounded-xl border border-border-default shadow-medium'

export default function ItemImage({
  src,
  alt,
  showPlaceholder = false,
  className = DEFAULT_IMAGE_CLASS,
  placeholderLabel = 'Image unavailable',
  priority = false,
}: ItemImageProps) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setBroken(false)
    setLoaded(false)
  }, [src])

  // Catch images that were already complete from cache before React attached onLoad, so the fade
  // does not leave a cached image stuck at opacity 0.
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true)
    }
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

  const image = (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      // React 19 renders fetchPriority (camelCase) as the lowercase fetchpriority HTML attribute.
      // High only for the primary image; secondary images inherit the browser default.
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setBroken(true)}
      className={`${className} transition-opacity duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
        loaded ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )

  // Non-primary images render exactly as before (just decode-gated fade); primary images get a
  // space-reserving wrapper so the detail layout does not jump when the image finishes decoding.
  if (!priority) return image

  return (
    <div
      data-primary-media
      className="mx-auto flex w-full max-w-xs items-center justify-center"
      style={{ minHeight: '12rem' }}
    >
      {image}
    </div>
  )
}
