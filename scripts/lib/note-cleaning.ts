import { inferImageCaptionFromUrl } from '../../src/utils/imageLabels.ts'
import { decodeHtml, stripSimpleHtml } from './text.ts'

export function normalizeNoteLineKey(line: string): string {
  return line
    .replace(/^[•*-]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function getImageCaptionNoise(html: string): Set<string> {
  const captions = new Set<string>()
  const addCaption = (caption?: string) => {
    const normalized = caption ? normalizeNoteLineKey(caption) : ''
    if (normalized) captions.add(normalized)
  }

  for (const match of html.matchAll(
    /<a[^>]+href=(["'])([^"']*?\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^"']*)?)\1[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    addCaption(stripSimpleHtml(decodeHtml(match[3])).trim())
    addCaption(inferImageCaptionFromUrl(match[2]))
  }

  for (const match of html.matchAll(
    /(?:<img[^>]+src=(["'])(.*?)\1[^>]*>|https?:\/\/[^\s"<>]+\.(?:png|jpg|jpeg|gif|bmp)(?:\?[^\s"<>]*)?)/gi
  )) {
    const url = match[2] ?? match[0]
    addCaption(inferImageCaptionFromUrl(url))
  }

  return captions
}

export function isImageCaptionNoiseLine(line: string, captions: Set<string>): boolean {
  return captions.has(normalizeNoteLineKey(line))
}

export function isAttributionNoiseLine(line: string): boolean {
  const normalized = line
    .replace(/^[•*-]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()

  return (
    /^,?\s*(?:and\s+)?corrections?\.?$/i.test(normalized) ||
    /^thanks\s+to\b/i.test(normalized) ||
    /^([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){0,4}(?:\s*,\s*[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){0,3})*)\s+for\s+(?:updated\s+)?(?:image|images|attack|attacks|information|entry|entries|corrections?|formatting|description|effect|effects|original|banner|code|stats|data|location|price|resists?)(?:\s+information)?\.?$/i.test(
      normalized
    )
  )
}

function splitNoteLines(notes: string | undefined): string[] {
  return notes
    ? notes
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : []
}

function joinNoteLines(lines: string[]): string | undefined {
  return lines.length > 0 ? lines.join('\n') : undefined
}

export function distributeSharedNoteLines<T extends { notes?: string }>(
  variants: T[]
): { sharedNotes?: string; variants: T[] } {
  if (variants.length === 0) return { variants }

  const lineGroups = variants.map((variant) => splitNoteLines(variant.notes))
  const keyGroups = lineGroups.map((lines) => new Set(lines.map(normalizeNoteLineKey)))
  const sharedKeys = new Set(
    [...keyGroups[0]].filter((key) => keyGroups.every((group) => group.has(key)))
  )

  if (sharedKeys.size === 0) return { variants }

  const sharedNotes = joinNoteLines(
    lineGroups[0].filter((line) => sharedKeys.has(normalizeNoteLineKey(line)))
  )
  const distributedVariants = variants.map((variant, index) => {
    const remainingNotes = joinNoteLines(
      lineGroups[index].filter((line) => !sharedKeys.has(normalizeNoteLineKey(line)))
    )
    const { notes: _notes, ...variantWithoutNotes } = variant
    return {
      ...variantWithoutNotes,
      ...(remainingNotes ? { notes: remainingNotes } : {}),
    } as T
  })

  return {
    sharedNotes,
    variants: distributedVariants,
  }
}
