import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

interface VariantLike {
  equipsClass?: string
  equipsClassUrl?: string
}

interface EntryLike {
  name?: string
  familyName?: string
  slug: string
  subtype?: string
  classSubcategory?: string
  forumUrl?: string
  sourceUrl?: string
  equipsClass?: string
  equipsClassUrl?: string
  shared?: Record<string, unknown>
  familySources?: Array<{ url?: string; title?: string }>
  levelVariants?: VariantLike[]
}

interface ClassArmorRelation {
  armorName: string
  armorSlug: string
  armorRoute: string
  className: string
  classSlug: string
  classRoute: string
}

const ARMOR_FILE = 'class-armors.json'
const REGULAR_CLASS_FILE = 'class-regular.json'
const OUTPUT_FILE = 'class-armor-relations.json'

function readJsonArray(filePath: string): EntryLike[] {
  if (!existsSync(filePath)) return []
  return JSON.parse(readFileSync(filePath, 'utf8')) as EntryLike[]
}

function displayName(entry: EntryLike): string {
  return entry.familyName ?? entry.name ?? entry.slug
}

function normalizeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function directForumPostUrl(url: string | undefined): string | undefined {
  const messageId = url?.match(/[?&]m=(\d+)/i)?.[1]
  return messageId ? `https://forums2.battleon.com/f/fb.asp?m=${messageId}` : url
}

function routeForClass(entry: EntryLike): string {
  return `/classes/${entry.slug}?type=class`
}

function collectClassSourceUrls(entry: EntryLike): string[] {
  return [
    entry.forumUrl,
    entry.sourceUrl,
    ...(entry.familySources ?? []).map((source) => source.url),
  ]
    .map(directForumPostUrl)
    .filter((url): url is string => Boolean(url))
}

function collectEquipsClasses(entry: EntryLike): Array<{ name?: string; url?: string }> {
  const values = new Map<string, { name?: string; url?: string }>()
  const add = (name: unknown, url: unknown) => {
    if (typeof name !== 'string' && typeof url !== 'string') return
    const normalizedUrl = typeof url === 'string' ? directForumPostUrl(url) : undefined
    const normalizedName = typeof name === 'string' ? name.trim() : undefined
    values.set(`${normalizedName?.toLowerCase() ?? ''}|${normalizedUrl ?? ''}`, {
      ...(normalizedName ? { name: normalizedName } : {}),
      ...(normalizedUrl ? { url: normalizedUrl } : {}),
    })
  }
  add(entry.equipsClass, entry.equipsClassUrl)
  add(entry.shared?.equipsClass, entry.shared?.equipsClassUrl)
  for (const variant of entry.levelVariants ?? []) {
    add(variant.equipsClass, variant.equipsClassUrl)
  }
  return [...values.values()]
}

export function writeClassArmorRelations(dataDir: string): ClassArmorRelation[] {
  const regularClasses = readJsonArray(path.join(dataDir, REGULAR_CLASS_FILE))
  const classBySourceUrl = new Map<string, EntryLike>()
  const classByName = new Map<string, EntryLike>()
  for (const classEntry of regularClasses) {
    classByName.set(normalizeLookupKey(displayName(classEntry)), classEntry)
    if (classEntry.name) classByName.set(normalizeLookupKey(classEntry.name), classEntry)
    for (const url of collectClassSourceUrls(classEntry)) {
      classBySourceUrl.set(url, classEntry)
    }
  }

  const relations: ClassArmorRelation[] = []
  const seen = new Set<string>()
  for (const armor of readJsonArray(path.join(dataDir, ARMOR_FILE))) {
    for (const equipped of collectEquipsClasses(armor)) {
      const classEntry =
        (equipped.url ? classBySourceUrl.get(equipped.url) : undefined) ??
        (equipped.name ? classByName.get(normalizeLookupKey(equipped.name)) : undefined)
      if (!classEntry) continue
      const key = `${armor.slug}|${classEntry.slug}`
      if (seen.has(key)) continue
      seen.add(key)
      relations.push({
        armorName: displayName(armor),
        armorSlug: armor.slug,
        armorRoute: routeForClass(armor),
        className: displayName(classEntry),
        classSlug: classEntry.slug,
        classRoute: routeForClass(classEntry),
      })
    }
  }

  relations.sort(
    (first, second) =>
      first.className.localeCompare(second.className) ||
      first.armorName.localeCompare(second.armorName)
  )
  writeFileSync(path.join(dataDir, OUTPUT_FILE), `${JSON.stringify(relations, null, 2)}\n`)
  return relations
}
