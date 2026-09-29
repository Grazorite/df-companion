import type { AccessoryEntry, AccessorySubtype } from '../types/accessory'
import type { CategoryMeta, Badge } from '../types/badge'
import type { ElementsData } from '../types/element'
import type { ItemFamily } from '../types/item'
import type { Pet } from '../types/pet'
import type { WeaponEntry, WeaponSubtype } from '../types/weapon'
import type { HousingEntry, HousingSubtype } from '../types/housing'
import type { ClassAbilityEntry, ClassAbilitySubtype } from '../types/classAbility'
import { normalizeHousingEntries } from './housingNormalization'
import accessoryManifestUrl from '../data/accessory-manifest.json?url'
import badgesManifestUrl from '../data/badges-manifest.json?url'
import artifactsUrl from '../data/artifacts.json?url'
import badgesUrl from '../data/badges.json?url'
import beltsUrl from '../data/belts.json?url'
import bracersUrl from '../data/bracers.json?url'
import capesWingsALUrl from '../data/capes-wings-a-l.json?url'
import capesWingsMZUrl from '../data/capes-wings-m-z.json?url'
import categoriesUrl from '../data/categories.json?url'
import classAbilitiesManifestUrl from '../data/class-abilities-manifest.json?url'
import classArmorsUrl from '../data/class-armors.json?url'
import classConsumablesUrl from '../data/class-consumables.json?url'
import classMiscellaneousUrl from '../data/class-miscellaneous.json?url'
import classRegularUrl from '../data/class-regular.json?url'
import elementsUrl from '../data/elements.json?url'
import guestsUrl from '../data/guests.json?url'
import housingBackgroundsUrl from '../data/housing-backgrounds.json?url'
import housingFloorsUrl from '../data/housing-floors.json?url'
import housingHousesUrl from '../data/housing-houses.json?url'
import housingManifestUrl from '../data/housing-manifest.json?url'
import housingRugsUrl from '../data/housing-rugs.json?url'
import housingShrubsUrl from '../data/housing-shrubs.json?url'
import housingStuffUrl from '../data/housing-stuff.json?url'
import housingWallItemsUrl from '../data/housing-wall-items.json?url'
import helmsALUrl from '../data/helms-a-l.json?url'
import helmsMZUrl from '../data/helms-m-z.json?url'
import necklacesUrl from '../data/necklaces.json?url'
import petsGuestsManifestUrl from '../data/pets-guests-manifest.json?url'
import petsUrl from '../data/pets.json?url'
import ringsUrl from '../data/rings.json?url'
import trinketsUrl from '../data/trinkets.json?url'
import weaponManifestUrl from '../data/weapon-manifest.json?url'
import weaponsDaggersAGUrl from '../data/weapons-daggers-a-g.json?url'
import weaponsDaggersHNUrl from '../data/weapons-daggers-h-n.json?url'
import weaponsDaggersOZUrl from '../data/weapons-daggers-o-z.json?url'
import weaponsScythesAJUrl from '../data/weapons-scythes-a-j.json?url'
import weaponsScythesKZUrl from '../data/weapons-scythes-k-z.json?url'
import weaponsStavesWandsAGUrl from '../data/weapons-staves-wands-a-g.json?url'
import weaponsStavesWandsHNUrl from '../data/weapons-staves-wands-h-n.json?url'
import weaponsStavesWandsOZUrl from '../data/weapons-staves-wands-o-z.json?url'
import weaponsSwordsAxesMacesAGUrl from '../data/weapons-swords-axes-maces-a-g.json?url'
import weaponsSwordsAxesMacesHNUrl from '../data/weapons-swords-axes-maces-h-n.json?url'
import weaponsSwordsAxesMacesOZUrl from '../data/weapons-swords-axes-maces-o-z.json?url'

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

export interface WeaponManifest {
  total: number
  bySubtype: Record<WeaponSubtype, number>
}

export interface HousingManifest {
  total: number
  bySubtype: Record<HousingSubtype, number>
}

export interface ClassAbilitiesManifest {
  total: number
  bySubtype: Record<ClassAbilitySubtype, number>
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

const weaponDataUrls: Record<WeaponSubtype, string[]> = {
  'sword-axe-mace': [
    weaponsSwordsAxesMacesAGUrl,
    weaponsSwordsAxesMacesHNUrl,
    weaponsSwordsAxesMacesOZUrl,
  ],
  'staff-wand': [weaponsStavesWandsAGUrl, weaponsStavesWandsHNUrl, weaponsStavesWandsOZUrl],
  dagger: [weaponsDaggersAGUrl, weaponsDaggersHNUrl, weaponsDaggersOZUrl],
  scythe: [weaponsScythesAJUrl, weaponsScythesKZUrl],
}

const housingDataUrls: Record<HousingSubtype, string[]> = {
  house: [housingHousesUrl],
  background: [housingBackgroundsUrl],
  floor: [housingFloorsUrl],
  rug: [housingRugsUrl],
  shrub: [housingShrubsUrl],
  stuff: [housingStuffUrl],
  'wall-item': [housingWallItemsUrl],
}

const classAbilityDataUrls: Record<ClassAbilitySubtype, string[]> = {
  class: [classArmorsUrl, classRegularUrl, classMiscellaneousUrl],
  consumable: [classConsumablesUrl],
}

let accessoryManifestCache: AccessoryManifest | null = null
let accessoryManifestPromise: Promise<AccessoryManifest> | null = null
const accessorySubtypeCache: Partial<Record<AccessorySubtype, AccessoryEntry[]>> = {}
const accessorySubtypePromises: Partial<Record<AccessorySubtype, Promise<AccessoryEntry[]>>> = {}
let accessoriesPromise: Promise<Record<AccessorySubtype, AccessoryEntry[]>> | null = null

let weaponManifestCache: WeaponManifest | null = null
let weaponManifestPromise: Promise<WeaponManifest> | null = null
const weaponSubtypeCache: Partial<Record<WeaponSubtype, WeaponEntry[]>> = {}
const weaponSubtypePromises: Partial<Record<WeaponSubtype, Promise<WeaponEntry[]>>> = {}
let weaponsPromise: Promise<Record<WeaponSubtype, WeaponEntry[]>> | null = null

let housingManifestCache: HousingManifest | null = null
let housingManifestPromise: Promise<HousingManifest> | null = null
const housingSubtypeCache: Partial<Record<HousingSubtype, HousingEntry[]>> = {}
const housingSubtypePromises: Partial<Record<HousingSubtype, Promise<HousingEntry[]>>> = {}
let housingPromise: Promise<Record<HousingSubtype, HousingEntry[]>> | null = null

let classAbilitiesManifestCache: ClassAbilitiesManifest | null = null
let classAbilitiesManifestPromise: Promise<ClassAbilitiesManifest> | null = null
const classAbilitySubtypeCache: Partial<Record<ClassAbilitySubtype, ClassAbilityEntry[]>> = {}
const classAbilitySubtypePromises: Partial<
  Record<ClassAbilitySubtype, Promise<ClassAbilityEntry[]>>
> = {}
let classAbilitiesPromise: Promise<Record<ClassAbilitySubtype, ClassAbilityEntry[]>> | null = null

import {
  dedupeClassAbilityEntries,
  isLoadedFamily,
  normalizeLoadedClassAbility,
  normalizeLoadedFamily,
  normalizeLoadedPet,
  repairLoadedSingleObtainMethods,
} from './dataNormalization'


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
        // Retired is fully determined at scrape time (tag + listing + note phrase);
        // the client reads the flag only, consistent with the other categories.
        retired: badge.retired,
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
    type LoadedPetEntry = (Pet & { specialMarkers?: string[] }) | ItemFamily
    petsPromise = Promise.all([
      fetchJson<LoadedPetEntry[]>(petsUrl),
      fetchJson<LoadedPetEntry[]>(guestsUrl),
    ]).then(([petsData, guestsData]) => {
      const pets = petsData.map((entry) =>
        isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : normalizeLoadedPet(entry)
      )
      const guests = guestsData.map((entry) =>
        isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : normalizeLoadedPet(entry)
      )
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
      const entries = datasets
        .flat()
        .map((entry) =>
          isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : repairLoadedSingleObtainMethods(entry)
        )
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

export async function loadWeaponManifest(): Promise<WeaponManifest> {
  if (weaponManifestCache) return weaponManifestCache
  if (!weaponManifestPromise) {
    weaponManifestPromise = fetchJson<WeaponManifest>(weaponManifestUrl).then((data) => {
      weaponManifestCache = data
      return weaponManifestCache
    })
  }
  return weaponManifestPromise
}

export async function loadWeaponsForSubtype(subtype: WeaponSubtype): Promise<WeaponEntry[]> {
  if (weaponSubtypeCache[subtype]) return weaponSubtypeCache[subtype]
  if (!weaponSubtypePromises[subtype]) {
    weaponSubtypePromises[subtype] = Promise.all(
      weaponDataUrls[subtype].map((url) => fetchJson<WeaponEntry[]>(url))
    ).then((datasets) => {
      const entries = datasets
        .flat()
        .map((entry) =>
          isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : repairLoadedSingleObtainMethods(entry)
        )
      weaponSubtypeCache[subtype] = entries
      return entries
    })
  }
  return weaponSubtypePromises[subtype]
}

export async function loadWeaponsBySubtype(): Promise<Record<WeaponSubtype, WeaponEntry[]>> {
  if (!weaponsPromise) {
    weaponsPromise = Promise.all([
      loadWeaponsForSubtype('sword-axe-mace'),
      loadWeaponsForSubtype('staff-wand'),
      loadWeaponsForSubtype('dagger'),
      loadWeaponsForSubtype('scythe'),
    ]).then(([swordAxeMace, staffWand, dagger, scythe]) => ({
      'sword-axe-mace': swordAxeMace,
      'staff-wand': staffWand,
      dagger,
      scythe,
    }))
  }
  return weaponsPromise
}

export async function loadHousingManifest(): Promise<HousingManifest> {
  if (housingManifestCache) return housingManifestCache
  if (!housingManifestPromise) {
    housingManifestPromise = fetchJson<HousingManifest>(housingManifestUrl).then((data) => {
      housingManifestCache = data
      return housingManifestCache
    })
  }
  return housingManifestPromise
}

export async function loadHousingForSubtype(subtype: HousingSubtype): Promise<HousingEntry[]> {
  if (housingSubtypeCache[subtype]) return housingSubtypeCache[subtype]
  if (!housingSubtypePromises[subtype]) {
    housingSubtypePromises[subtype] = Promise.all(
      housingDataUrls[subtype].map((url) => fetchJson<HousingEntry[]>(url))
    ).then((datasets) => {
      const entries = normalizeHousingEntries(
        datasets
          .flat()
          .map((entry) => (isLoadedFamily(entry) ? normalizeLoadedFamily(entry) : entry))
      )
      housingSubtypeCache[subtype] = entries
      return entries
    })
  }
  return housingSubtypePromises[subtype]
}

export async function loadHousingBySubtype(): Promise<Record<HousingSubtype, HousingEntry[]>> {
  if (!housingPromise) {
    housingPromise = Promise.all([
      loadHousingForSubtype('house'),
      loadHousingForSubtype('background'),
      loadHousingForSubtype('floor'),
      loadHousingForSubtype('rug'),
      loadHousingForSubtype('shrub'),
      loadHousingForSubtype('stuff'),
      loadHousingForSubtype('wall-item'),
    ]).then(([house, background, floor, rug, shrub, stuff, wallItem]) => ({
      house,
      background,
      floor,
      rug,
      shrub,
      stuff,
      'wall-item': wallItem,
    }))
  }
  return housingPromise
}

export async function loadClassAbilitiesManifest(): Promise<ClassAbilitiesManifest> {
  if (classAbilitiesManifestCache) return classAbilitiesManifestCache
  if (!classAbilitiesManifestPromise) {
    classAbilitiesManifestPromise = fetchJson<ClassAbilitiesManifest>(
      classAbilitiesManifestUrl
    ).then((data) => {
      classAbilitiesManifestCache = data
      return classAbilitiesManifestCache
    })
  }
  return classAbilitiesManifestPromise
}

export async function loadClassAbilitiesForSubtype(
  subtype: ClassAbilitySubtype
): Promise<ClassAbilityEntry[]> {
  if (classAbilitySubtypeCache[subtype]) return classAbilitySubtypeCache[subtype]
  if (!classAbilitySubtypePromises[subtype]) {
    classAbilitySubtypePromises[subtype] = Promise.all(
      classAbilityDataUrls[subtype].map((url) => fetchJson<ClassAbilityEntry[]>(url))
    ).then((datasets) => {
      const entries = dedupeClassAbilityEntries(
        datasets.flat().map((entry) => normalizeLoadedClassAbility(entry))
      )
      classAbilitySubtypeCache[subtype] = entries
      return entries
    })
  }
  return classAbilitySubtypePromises[subtype]
}

export async function loadClassAbilitiesBySubtype(): Promise<
  Record<ClassAbilitySubtype, ClassAbilityEntry[]>
> {
  if (!classAbilitiesPromise) {
    classAbilitiesPromise = Promise.all([
      loadClassAbilitiesForSubtype('class'),
      loadClassAbilitiesForSubtype('consumable'),
    ]).then(([classEntries, consumables]) => ({
      class: classEntries,
      consumable: consumables,
    }))
  }
  return classAbilitiesPromise
}
