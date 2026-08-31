import type { AlsoSeeRef, AlternativeImage, ItemFamily, MechanicsBlock, ObtainVariant } from './item'
import type { GuestAttack, GuestAttackSet, GuestStats } from './pet'

export type ClassAbilitySubtype = 'class' | 'consumable'
export type ClassSubcategory = 'armor' | 'regular' | 'miscellaneous'
export type ConsumableKind = 'dust' | 'food' | 'rune'

export interface ClassAbilitySubtypeMeta {
  subtype: ClassAbilitySubtype
  label: string
  route: string
  dataFiles: string[]
  shortDescription: string
  sourceUrl: string
}

export interface ClassSubcategoryMeta {
  id: ClassSubcategory
  label: string
  shortDescription: string
}

export interface ClassAbilityItem {
  id: string
  name: string
  slug: string
  type: 'class-ability'
  subtype: ClassAbilitySubtype
  classSubcategory?: ClassSubcategory
  consumableKind?: ConsumableKind
  description: string
  releaseDate?: string
  forumUrl: string
  sourceUrl: string
  imageUrl?: string
  alternativeImages?: AlternativeImage[]
  location?: string
  price?: string
  sellback?: string
  requiredItems?: string
  requirements?: string
  effect?: string
  effectType?: string
  equipsClass?: string
  equipsClassUrl?: string
  defaultWeapon?: string
  defaultWeaponUrl?: string
  guestStats?: GuestStats
  attacks?: GuestAttack[]
  attackSets?: GuestAttackSet[]
  mechanics?: MechanicsBlock[]
  dialogue?: string
  obtainMethods?: ObtainVariant[]
  level?: string
  rarity?: string
  notes?: string
  alsoSee?: AlsoSeeRef[]
  tags: string[]
  daRequired?: boolean
  dcRequired?: boolean
  dmRequired?: boolean
  hasFree?: boolean
  hasMerge?: boolean
  isTemp?: boolean
  isRare?: boolean
  isSeasonal?: boolean
  isSpecialOffer?: boolean
  isSpecialCharacter?: boolean
  retired?: boolean
}

export type ClassAbilityFamily = ItemFamily & {
  type: 'class-ability'
  subtype: ClassAbilitySubtype
  classSubcategory?: ClassSubcategory
  consumableKind?: ConsumableKind
}

export type ClassAbilityEntry = ClassAbilityItem | ClassAbilityFamily

export function isClassAbilityFamily(entry: ClassAbilityEntry): entry is ClassAbilityFamily {
  return 'levelVariants' in entry
}

export interface ClassAbilityFilters {
  query?: string
  classSubcategories?: ClassSubcategory[]
  excludeClassSubcategories?: ClassSubcategory[]
  access?: Array<'multiple' | 'da' | 'merge' | 'dc' | 'dm'>
  excludeAccess?: Array<'multiple' | 'da' | 'merge' | 'dc' | 'dm'>
  categories?: Array<'temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired'>
  excludeCategories?: Array<'temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired'>
  misc?: Array<'special-character'>
  excludeMisc?: Array<'special-character'>
  consumableKinds?: ConsumableKind[]
  excludeConsumableKinds?: ConsumableKind[]
}

export const CLASS_SUBCATEGORIES: ClassSubcategoryMeta[] = [
  {
    id: 'armor',
    label: 'Armors',
    shortDescription:
      "Physical armors that can be stored in the player's inventory or bank, and equipped to use its corresponding class.",
  },
  {
    id: 'regular',
    label: 'Regular',
    shortDescription:
      'Regular classes that are able to be purchased, unlocked, and/or trained; intended to be used by the player.',
  },
  {
    id: 'miscellaneous',
    label: 'Miscellaneous',
    shortDescription:
      'Miscellaneous classes that are offered during select quests or circumstances; not intended to be used by the player extensively.',
  },
]

export const CLASS_ABILITY_DESCRIPTION =
  'All the different stats / abilities for the different classes in DragonFable. Pirates, Paladins, Chickencow Lords, and more!'

export const CLASS_ABILITY_SUBTYPES: ClassAbilitySubtypeMeta[] = [
  {
    subtype: 'class',
    label: 'Classes',
    route: '/classes',
    dataFiles: ['class-armors.json', 'class-regular.json', 'class-miscellaneous.json'],
    shortDescription: CLASS_ABILITY_DESCRIPTION,
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=22303582',
  },
  {
    subtype: 'consumable',
    label: 'Consumables',
    route: '/consumables',
    dataFiles: ['class-consumables.json'],
    shortDescription: CLASS_ABILITY_DESCRIPTION,
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=22304639',
  },
]
