import type { AccessoryEntry, AccessorySubtype } from '../types/accessory'
import type { CategoryMeta, Badge } from '../types/badge'
import type { ElementsData } from '../types/element'
import type { ItemFamily } from '../types/item'
import type { Pet } from '../types/pet'
import accessoryManifestUrl from '../data/accessory-manifest.json?url'
import badgesManifestUrl from '../data/badges-manifest.json?url'
import artifactsUrl from '../data/artifacts.json?url'
import badgesUrl from '../data/badges.json?url'
import beltsUrl from '../data/belts.json?url'
import bracersUrl from '../data/bracers.json?url'
import capesWingsALUrl from '../data/capes-wings-a-l.json?url'
import capesWingsMZUrl from '../data/capes-wings-m-z.json?url'
import categoriesUrl from '../data/categories.json?url'
import elementsUrl from '../data/elements.json?url'
import guestsUrl from '../data/guests.json?url'
import helmsALUrl from '../data/helms-a-l.json?url'
import helmsMZUrl from '../data/helms-m-z.json?url'
import necklacesUrl from '../data/necklaces.json?url'
import petsGuestsManifestUrl from '../data/pets-guests-manifest.json?url'
import petsUrl from '../data/pets.json?url'
import ringsUrl from '../data/rings.json?url'
import trinketsUrl from '../data/trinkets.json?url'

let badgesCache: Badge[] | null = null
let badgesPromise: Promise<Badge[]> | null = null

let categoriesCache: CategoryMeta[] | null = null
let categoriesPromise: Promise<CategoryMeta[]> | null = null

export interface BadgeManifest {
  total: number
}

let badgesManifestCache: BadgeManifest | null = null
let badgesManifestPromise: Promise<BadgeManifest> | null = null

let petsCache: Array<Pet | ItemFamily> | null = null
let petsPromise: Promise<Array<Pet | ItemFamily>> | null = null

export interface PetsGuestsManifest {
  total: number
  byType: {
    pet: number
    guest: number
  }
}

let petsGuestsManifestCache: PetsGuestsManifest | null = null
let petsGuestsManifestPromise: Promise<PetsGuestsManifest> | null = null

let elementsCache: ElementsData | null = null
let elementsPromise: Promise<ElementsData> | null = null

export interface AccessoryManifest {
  total: number
  bySubtype: Record<AccessorySubtype, number>
}

const accessoryDataUrls: Record<AccessorySubtype, string[]> = {
  artifact: [artifactsUrl],
  belt: [beltsUrl],
  bracer: [bracersUrl],
  'cape-wing': [capesWingsALUrl, capesWingsMZUrl],
  helm: [helmsALUrl, helmsMZUrl],
  necklace: [necklacesUrl],
  ring: [ringsUrl],
  trinket: [trinketsUrl],
}

let accessoryManifestCache: AccessoryManifest | null = null
let accessoryManifestPromise: Promise<AccessoryManifest> | null = null
const accessorySubtypeCache: Partial<Record<AccessorySubtype, AccessoryEntry[]>> = {}
const accessorySubtypePromises: Partial<Record<AccessorySubtype, Promise<AccessoryEntry[]>>> = {}
let accessoriesPromise: Promise<Record<AccessorySubtype, AccessoryEntry[]>> | null = null

function normalizeLoadedPet<T extends Pet & { specialMarkers?: string[] }>(pet: T): Pet {
  const normalized = { ...pet } as Pet & { specialMarkers?: string[] }
  if (!normalized.traits && normalized.specialMarkers) {
    normalized.traits = normalized.specialMarkers
    delete normalized.specialMarkers
  }
  if (!normalized.traits) normalized.traits = []
  return normalized as Pet
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function loadBadges(): Promise<Badge[]> {
  if (badgesCache) return badgesCache
  if (!badgesPromise) {
    badgesPromise = fetchJson<Badge[]>(badgesUrl).then((data) => {
      badgesCache = data.map((badge) => ({
        ...badge,
        retired: badge.retired || /badge was retired on/i.test(badge.notes ?? ''),
        imageUrl: badge.imageUrl ?? badge.forumImageUrl,
      }))
      return badgesCache
    })
  }
  return badgesPromise
}

export async function loadCategories(): Promise<CategoryMeta[]> {
  if (categoriesCache) return categoriesCache
  if (!categoriesPromise) {
    categoriesPromise = fetchJson<CategoryMeta[]>(categoriesUrl).then((data) => {
      categoriesCache = data
      return categoriesCache
    })
  }
  return categoriesPromise
}

export async function loadBadgeManifest(): Promise<BadgeManifest> {
  if (badgesManifestCache) return badgesManifestCache
  if (!badgesManifestPromise) {
    badgesManifestPromise = fetchJson<BadgeManifest>(badgesManifestUrl).then((data) => {
      badgesManifestCache = data
      return badgesManifestCache
    })
  }
  return badgesManifestPromise
}

export async function loadPetsAndGuests(): Promise<Array<Pet | ItemFamily>> {
  if (petsCache) return petsCache
  if (!petsPromise) {
    petsPromise = Promise.all([
      fetchJson<Array<Pet & { specialMarkers?: string[] }>>(petsUrl),
      fetchJson<Array<Pet & { specialMarkers?: string[] }>>(guestsUrl),
    ]).then(([petsData, guestsData]) => {
      const pets = petsData.map(normalizeLoadedPet)
      const guests = guestsData.map(normalizeLoadedPet)
      petsCache = [...pets, ...guests] as Array<Pet | ItemFamily>
      return petsCache
    })
  }
  return petsPromise
}

export async function loadPetsGuestsManifest(): Promise<PetsGuestsManifest> {
  if (petsGuestsManifestCache) return petsGuestsManifestCache
  if (!petsGuestsManifestPromise) {
    petsGuestsManifestPromise = fetchJson<PetsGuestsManifest>(petsGuestsManifestUrl).then(
      (data) => {
        petsGuestsManifestCache = data
        return petsGuestsManifestCache
      }
    )
  }
  return petsGuestsManifestPromise
}

export async function loadElements(): Promise<ElementsData> {
  if (elementsCache) return elementsCache
  if (!elementsPromise) {
    elementsPromise = fetchJson<ElementsData>(elementsUrl).then((data) => {
      elementsCache = data
      return elementsCache
    })
  }
  return elementsPromise
}

export async function loadAccessoryManifest(): Promise<AccessoryManifest> {
  if (accessoryManifestCache) return accessoryManifestCache
  if (!accessoryManifestPromise) {
    accessoryManifestPromise = fetchJson<AccessoryManifest>(accessoryManifestUrl).then((data) => {
      accessoryManifestCache = data
      return accessoryManifestCache
    })
  }
  return accessoryManifestPromise
}

export async function loadAccessoriesForSubtype(
  subtype: AccessorySubtype
): Promise<AccessoryEntry[]> {
  if (accessorySubtypeCache[subtype]) return accessorySubtypeCache[subtype]
  if (!accessorySubtypePromises[subtype]) {
    accessorySubtypePromises[subtype] = Promise.all(
      accessoryDataUrls[subtype].map((url) => fetchJson<AccessoryEntry[]>(url))
    ).then((datasets) => {
      const entries = datasets.flat()
      accessorySubtypeCache[subtype] = entries
      return entries
    })
  }
  return accessorySubtypePromises[subtype]
}

export async function loadAccessoriesBySubtype(): Promise<
  Record<AccessorySubtype, AccessoryEntry[]>
> {
  if (!accessoriesPromise) {
    accessoriesPromise = Promise.all([
      loadAccessoriesForSubtype('artifact'),
      loadAccessoriesForSubtype('belt'),
      loadAccessoriesForSubtype('bracer'),
      loadAccessoriesForSubtype('cape-wing'),
      loadAccessoriesForSubtype('helm'),
      loadAccessoriesForSubtype('necklace'),
      loadAccessoriesForSubtype('ring'),
      loadAccessoriesForSubtype('trinket'),
    ]).then(([artifact, belt, bracer, capeWing, helm, necklace, ring, trinket]) => ({
      artifact,
      belt,
      bracer,
      'cape-wing': capeWing,
      helm,
      necklace,
      ring,
      trinket,
    }))
  }
  return accessoriesPromise
}
