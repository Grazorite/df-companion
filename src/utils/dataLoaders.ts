import type { AccessoryEntry, AccessorySubtype } from '../types/accessory'
import type { CategoryMeta, Badge } from '../types/badge'
import type { ElementsData } from '../types/element'
import type { ItemFamily } from '../types/item'
import type { Pet } from '../types/pet'
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
import petsUrl from '../data/pets.json?url'
import ringsUrl from '../data/rings.json?url'
import trinketsUrl from '../data/trinkets.json?url'

let badgesCache: Badge[] | null = null
let badgesPromise: Promise<Badge[]> | null = null

let categoriesCache: CategoryMeta[] | null = null
let categoriesPromise: Promise<CategoryMeta[]> | null = null

let petsCache: Array<Pet | ItemFamily> | null = null
let petsPromise: Promise<Array<Pet | ItemFamily>> | null = null

let elementsCache: ElementsData | null = null
let elementsPromise: Promise<ElementsData> | null = null

let accessoriesCache: Record<AccessorySubtype, AccessoryEntry[]> | null = null
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

export async function loadAccessoriesBySubtype(): Promise<
  Record<AccessorySubtype, AccessoryEntry[]>
> {
  if (accessoriesCache) return accessoriesCache
  if (!accessoriesPromise) {
    accessoriesPromise = Promise.all([
      fetchJson<AccessoryEntry[]>(artifactsUrl),
      fetchJson<AccessoryEntry[]>(beltsUrl),
      fetchJson<AccessoryEntry[]>(bracersUrl),
      fetchJson<AccessoryEntry[]>(capesWingsALUrl),
      fetchJson<AccessoryEntry[]>(capesWingsMZUrl),
      fetchJson<AccessoryEntry[]>(helmsALUrl),
      fetchJson<AccessoryEntry[]>(helmsMZUrl),
      fetchJson<AccessoryEntry[]>(necklacesUrl),
      fetchJson<AccessoryEntry[]>(ringsUrl),
      fetchJson<AccessoryEntry[]>(trinketsUrl),
    ]).then(
      ([
        artifactsData,
        beltsData,
        bracersData,
        capesWingsALData,
        capesWingsMZData,
        helmsALData,
        helmsMZData,
        necklacesData,
        ringsData,
        trinketsData,
      ]) => {
        accessoriesCache = {
          artifact: artifactsData,
          belt: beltsData,
          bracer: bracersData,
          'cape-wing': [...capesWingsALData, ...capesWingsMZData],
          helm: [...helmsALData, ...helmsMZData],
          necklace: necklacesData,
          ring: ringsData,
          trinket: trinketsData,
        }
        return accessoriesCache
      }
    )
  }
  return accessoriesPromise
}
