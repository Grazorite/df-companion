import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

interface EntryLike {
  name?: string
  familyName?: string
  slug: string
  subtype?: string
  classSubcategory?: string
  modifies?: string
  armorCustomization?: { modifies?: string }
  shared?: Record<string, unknown>
  levelVariants?: Array<Record<string, unknown>>
  attackSets?: AttackSetLike[]
}

interface AttackSetLike {
  id?: string
  label?: string
  attacks?: unknown[]
}

interface ArtifactRelation {
  className: string
  classSlug: string
  classSubcategory?: string
  classRoute: string
  artifactName: string
  artifactSlug: string
  artifactSubtype: string
  artifactRoute: string
  artifactAliases?: string[]
}

const CLASS_DATA_FILES = ['class-regular.json', 'class-miscellaneous.json']
const ARTIFACT_DATA_FILE = 'artifacts.json'
const OUTPUT_FILE = 'class-artifact-relations.json'

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

function routeForClass(entry: EntryLike): string {
  return `/classes/${entry.slug}?type=class`
}

function routeForArtifact(entry: EntryLike): string {
  return `/accessories/${entry.slug}?type=${encodeURIComponent(entry.subtype ?? 'artifact')}`
}

function collectAttackSets(entry: EntryLike): AttackSetLike[] {
  const sets: AttackSetLike[] = []
  if (Array.isArray(entry.attackSets)) sets.push(...entry.attackSets)
  const sharedAttackSets = entry.shared?.attackSets
  if (Array.isArray(sharedAttackSets)) sets.push(...(sharedAttackSets as AttackSetLike[]))
  for (const variant of entry.levelVariants ?? []) {
    if (Array.isArray(variant.attackSets)) sets.push(...(variant.attackSets as AttackSetLike[]))
  }
  return sets
}

function collectModifies(entry: EntryLike): string[] {
  const values = new Set<string>()
  if (entry.modifies) values.add(entry.modifies)
  if (entry.armorCustomization?.modifies) values.add(entry.armorCustomization.modifies)
  if (typeof entry.shared?.modifies === 'string') values.add(entry.shared.modifies)
  if (
    entry.shared?.armorCustomization &&
    typeof entry.shared.armorCustomization === 'object' &&
    'modifies' in entry.shared.armorCustomization &&
    typeof entry.shared.armorCustomization.modifies === 'string'
  ) {
    values.add(entry.shared.armorCustomization.modifies)
  }
  for (const variant of entry.levelVariants ?? []) {
    if (typeof variant.modifies === 'string') values.add(variant.modifies)
    if (
      variant.armorCustomization &&
      typeof variant.armorCustomization === 'object' &&
      'modifies' in variant.armorCustomization &&
      typeof variant.armorCustomization.modifies === 'string'
    ) {
      values.add(variant.armorCustomization.modifies)
    }
  }
  return [...values]
}

function candidateArtifactNames(label: string, className: string): string[] {
  const names = new Set([label])
  if (/^Dragon's\s+/i.test(label)) {
    names.add(label.replace(/^Dragon's\s+/i, "DragonLord's "))
  }
  if (!new RegExp(`^${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'s\\s+`, 'i').test(label)) {
    const finalWord = label.match(/([A-Za-z][A-Za-z'’-]*)$/)?.[1]
    if (finalWord) names.add(`${className}'s ${finalWord}`)
  }
  return [...names]
}

function artifactAliases(artifactName: string, attackSetLabel: string): string[] | undefined {
  const aliases = new Set<string>()
  if (artifactName !== attackSetLabel) aliases.add(attackSetLabel)
  return aliases.size > 0 ? [...aliases].sort() : undefined
}

function textMentionsName(text: string, name: string): boolean {
  const normalizedText = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const normalizedName = name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (!normalizedText || !normalizedName) return false
  return new RegExp(`(?:^|\\s)${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(
    normalizedText
  )
}

function addRelation(
  relations: ArtifactRelation[],
  seen: Set<string>,
  classEntry: EntryLike,
  artifact: EntryLike,
  aliases?: string[]
) {
  const key = `${classEntry.slug}|${artifact.slug}`
  if (seen.has(key)) return
  seen.add(key)
  const filteredAliases = aliases?.filter((alias) => alias !== displayName(artifact))
  relations.push({
    className: displayName(classEntry),
    classSlug: classEntry.slug,
    ...(classEntry.classSubcategory ? { classSubcategory: classEntry.classSubcategory } : {}),
    classRoute: routeForClass(classEntry),
    artifactName: displayName(artifact),
    artifactSlug: artifact.slug,
    artifactSubtype: artifact.subtype ?? 'artifact',
    artifactRoute: routeForArtifact(artifact),
    ...(filteredAliases?.length ? { artifactAliases: [...new Set(filteredAliases)].sort() } : {}),
  })
}

export function writeClassArtifactRelations(dataDir: string): ArtifactRelation[] {
  const artifacts = readJsonArray(path.join(dataDir, ARTIFACT_DATA_FILE))
  const artifactsByKey = new Map<string, EntryLike>()
  for (const artifact of artifacts) {
    artifactsByKey.set(normalizeLookupKey(displayName(artifact)), artifact)
    if (artifact.name) artifactsByKey.set(normalizeLookupKey(artifact.name), artifact)
  }

  const relations: ArtifactRelation[] = []
  const seen = new Set<string>()
  const classEntries = CLASS_DATA_FILES.flatMap((file) => readJsonArray(path.join(dataDir, file)))

  for (const entry of classEntries) {
    const className = displayName(entry)
    for (const set of collectAttackSets(entry)) {
      if (!set.label || set.id === 'base') continue
      const artifact = candidateArtifactNames(set.label, className)
        .map((name) => artifactsByKey.get(normalizeLookupKey(name)))
        .find(Boolean)
      if (!artifact) continue

      const artifactName = displayName(artifact)
      const aliases = artifactAliases(artifactName, set.label)
      addRelation(relations, seen, entry, artifact, aliases)
    }
  }

  const classEntriesByNameLength = [...classEntries].sort(
    (first, second) => displayName(second).length - displayName(first).length
  )
  for (const artifact of artifacts) {
    const modifiesValues = collectModifies(artifact)
    if (modifiesValues.length === 0) continue
    for (const classEntry of classEntriesByNameLength) {
      if (!modifiesValues.some((modifies) => textMentionsName(modifies, displayName(classEntry)))) {
        continue
      }
      addRelation(relations, seen, classEntry, artifact)
    }
  }

  relations.sort(
    (first, second) =>
      first.className.localeCompare(second.className) ||
      first.artifactName.localeCompare(second.artifactName)
  )

  writeFileSync(path.join(dataDir, OUTPUT_FILE), `${JSON.stringify(relations, null, 2)}\n`)
  return relations
}
