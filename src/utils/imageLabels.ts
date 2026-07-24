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

function cleanCaption(caption?: string): string | undefined {
  const value = caption?.trim()
  if (!value || value.length === 0) return undefined
  if (/^Alternative\s+\d+$/i.test(value)) return undefined
  return value
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
  const images: DisplayImage[] = []

  if (imageUrl) {
    images.push({
      url: imageUrl,
      caption: validAlternatives.length > 0 ? 'Main' : mainCaption,
    })
  }

  validAlternatives.forEach((image, index) => {
    images.push({
      url: image.url,
      caption:
        cleanCaption(image.caption) ??
        inferImageCaptionFromUrl(image.url) ??
        `Alternative ${index + 1}`,
    })
  })

  return images
}
