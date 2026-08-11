interface AlternativeImageLike {
  url: string
  caption?: string
}

interface BuildDisplayImagesOptions {
  imageUrl?: string
  alternativeImages?: AlternativeImageLike[]
  mainCaption: string
}

export interface DisplayImage {
  url: string
  caption: string
}

export function normalizeImageCaption(caption?: string): string | undefined {
  const value = caption?.trim()
  if (!value || value.length === 0) return undefined
  if (/^Alternative\s+\d+$/i.test(value)) return undefined
  if (/^this chart$/i.test(value)) return 'All Appearances'
  return value
}

function normalizeCaptionComparable(value: string): string {
  return value.replace(/[\\/]/g, '/').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function normalizeSlashCaption(value: string): string {
  return value
    .split(/[\\/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' / ')
}

export function expandSlashCaptionFromText(caption?: string, text?: string): string | undefined {
  const normalizedCaption = caption ? normalizeCaptionComparable(caption) : undefined
  if (!normalizedCaption || !text) return undefined

  const candidateGroups = text
    .split('\n')
    .flatMap((line) => {
      const trimmed = line.replace(/^[\s•-]+/, '').trim()
      const alsoSeeMatch = trimmed.match(/^Also See\s*\(([^)]+)\)\s*:/i)
      return [alsoSeeMatch?.[1], trimmed].filter((value): value is string => Boolean(value))
    })
    .filter((value) => /[\\/]/.test(value))

  for (const group of candidateGroups) {
    const normalizedGroup = normalizeSlashCaption(group)
    const groupParts = normalizedGroup.split(' / ').map(normalizeCaptionComparable)
    if (
      normalizeCaptionComparable(normalizedGroup) === normalizedCaption ||
      groupParts.includes(normalizedCaption)
    ) {
      return normalizedGroup
    }
  }

  return undefined
}

export function inferImageCaptionFromUrl(url: string): string | undefined {
  const fileName = decodeURIComponent(url.split('/').at(-1) ?? '').replace(/\?.*$/, '')
  const stem = fileName.replace(/\.(?:png|jpg|jpeg|gif|bmp)$/i, '')
  const suffix = stem.match(/-([^-]+)$/)?.[1]
  if (!suffix || /^\d+$/.test(suffix)) return undefined

  if (/^clicked$/i.test(suffix)) return 'Clicked Appearance'

  return suffix
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildDisplayImages({
  imageUrl,
  alternativeImages,
  mainCaption,
}: BuildDisplayImagesOptions): DisplayImage[] {
  const validAlternatives = (alternativeImages ?? []).filter((image) => image.url)
  const otherAlternatives = imageUrl
    ? validAlternatives.filter((image) => image.url !== imageUrl)
    : validAlternatives
  const images: DisplayImage[] = []

  if (imageUrl) {
    // When the main image also appears in the alternatives list carrying a bold
    // caption (weapon-style captioned main), prefer that caption over the generic
    // "Main" label. Otherwise fall back to "Main" (when other images exist) or the
    // provided mainCaption.
    const mainMatch = validAlternatives.find((image) => image.url === imageUrl)
    const mainMatchCaption = mainMatch
      ? (normalizeImageCaption(mainMatch.caption) ?? inferImageCaptionFromUrl(mainMatch.url))
      : undefined
    images.push({
      url: imageUrl,
      caption: mainMatchCaption ?? (otherAlternatives.length > 0 ? 'Main' : mainCaption),
    })
  }

  otherAlternatives.forEach((image, index) => {
    images.push({
      url: image.url,
      caption:
        normalizeImageCaption(image.caption) ??
        inferImageCaptionFromUrl(image.url) ??
        `Alternative ${index + 1}`,
    })
  })

  return images
}
