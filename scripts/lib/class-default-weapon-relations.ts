import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

interface SourceRefLike {
  url?: string
  title?: string
}

interface VariantLike {
  sourceUrl?: string
  defaultWeapon?: string
  defaultWeaponUrl?: string
}

interface EntryLike {
  name?: string
  familyName?: string
  slug: string
  subtype?: string
  classSubcategory?: string
  forumUrl?: string
  sourceUrl?: string
  defaultWeapon?: string
  defaultWeaponUrl?: string
  shared?: Record<string, unknown>
  familySources?: SourceRefLike[]
  levelVariants?: VariantLike[]
}

interface ClassDefaultWeaponRelation {
  className: string
  classSlug: string
  classSubcategory?: string
  classRoute: string
  weaponName: string
  weaponSlug: string
  weaponSubtype: string
  weaponRoute: string
}

const CLASS_DATA_FILES = ['class-regular.json', 'class-miscellaneous.json']
const WEAPON_DATA_FILES = [
  'weapons-swords-axes-maces-a-g.json',
  'weapons-swords-axes-maces-h-n.json',
  'weapons-swords-axes-maces-o-z.json',
  'weapons-staves-wands-a-g.json',
  'weapons-staves-wands-h-n.json',
  'weapons-staves-wands-o-z.json',
  'weapons-daggers-a-g.json',
  'weapons-daggers-h-n.json',
  'weapons-daggers-o-z.json',
  'weapons-scythes-a-j.json',
  'weapons-scythes-k-z.json',
]
const OUTPUT_FILE = 'class-default-weapon-relations.json'

function readJsonArray(filePath: string): EntryLike[] {
  if (!existsSync(filePath)) return []
  return JSON.parse(readFileSync(filePath, 'utf8')) as EntryLike[]
}

function displayName(entry: EntryLike): string {
  return entry.familyName ?? entry.name ?? entry.slug
}

function directForumPostUrl(url: string | undefined): string | undefined {
  const messageId = url?.match(/[?&]m=(\d+)/i)?.[1]
  return messageId ? `https://forums2.battleon.com/f/fb.asp?m=${messageId}` : url
}

function routeForClass(entry: EntryLike): string {
  return `/classes/${entry.slug}?type=class`
}

function routeForWeapon(entry: EntryLike): string {
  return `/weapons/${entry.slug}?type=${encodeURIComponent(entry.subtype ?? 'sword-axe-mace')}`
}

function collectSourceUrls(entry: EntryLike): string[] {
  return [
    entry.forumUrl,
    entry.sourceUrl,
    ...(entry.familySources ?? []).map((source) => source.url),
    ...(entry.levelVariants ?? []).map((variant) => variant.sourceUrl),
  ]
    .map(directForumPostUrl)
    .filter((url): url is string => Boolean(url))
}

function collectDefaultWeapons(entry: EntryLike): Array<{ name: string; url?: string }> {
  const values = new Map<string, { name: string; url?: string }>()
  const add = (name: unknown, url: unknown) => {
    if (typeof name !== 'string' || !name.trim()) return
    const normalizedUrl = typeof url === 'string' ? directForumPostUrl(url) : undefined
    values.set(`${name.trim().toLowerCase()}|${normalizedUrl ?? ''}`, {
      name: name.trim(),
      ...(normalizedUrl ? { url: normalizedUrl } : {}),
    })
  }
  add(entry.defaultWeapon, entry.defaultWeaponUrl)
  add(entry.shared?.defaultWeapon, entry.shared?.defaultWeaponUrl)
  for (const variant of entry.levelVariants ?? []) {
    add(variant.defaultWeapon, variant.defaultWeaponUrl)
  }
  return [...values.values()]
}

export function writeClassDefaultWeaponRelations(dataDir: string): ClassDefaultWeaponRelation[] {
  const weaponBySourceUrl = new Map<string, EntryLike>()
  for (const file of WEAPON_DATA_FILES) {
    for (const weapon of readJsonArray(path.join(dataDir, file))) {
      for (const url of collectSourceUrls(weapon)) {
        weaponBySourceUrl.set(url, weapon)
      }
    }
  }

  const relations: ClassDefaultWeaponRelation[] = []
  const seen = new Set<string>()
  const classEntries = CLASS_DATA_FILES.flatMap((file) => readJsonArray(path.join(dataDir, file)))

  for (const classEntry of classEntries) {
    for (const defaultWeapon of collectDefaultWeapons(classEntry)) {
      if (!defaultWeapon.url) continue
      const weapon = weaponBySourceUrl.get(defaultWeapon.url)
      if (!weapon) continue
      const key = `${classEntry.slug}|${weapon.slug}`
      if (seen.has(key)) continue
      seen.add(key)
      relations.push({
        className: displayName(classEntry),
        classSlug: classEntry.slug,
        ...(classEntry.classSubcategory ? { classSubcategory: classEntry.classSubcategory } : {}),
        classRoute: routeForClass(classEntry),
        weaponName: displayName(weapon),
        weaponSlug: weapon.slug,
        weaponSubtype: weapon.subtype ?? 'sword-axe-mace',
        weaponRoute: routeForWeapon(weapon),
      })
    }
  }

  relations.sort(
    (first, second) =>
      first.className.localeCompare(second.className) ||
      first.weaponName.localeCompare(second.weaponName)
  )
  writeFileSync(path.join(dataDir, OUTPUT_FILE), `${JSON.stringify(relations, null, 2)}\n`)
  return relations
}
