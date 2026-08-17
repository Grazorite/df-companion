import type { AlsoSeeRef, AlternativeImage, ItemFamily, ObtainVariant } from './item'

export type HousingSubtype =
  | 'house'
  | 'background'
  | 'floor'
  | 'rug'
  | 'shrub'
  | 'stuff'
  | 'wall-item'

export interface HousingSubtypeMeta {
  subtype: HousingSubtype
  label: string
  route: string
  dataFiles: string[]
  shortDescription: string
  sourceUrl: string
}

export interface HousingItem {
  id: string
  name: string
  slug: string
  type: 'housing'
  subtype: HousingSubtype
  description: string
  forumUrl: string
  sourceUrl: string
  imageUrl?: string
  alternativeImages?: AlternativeImage[]
  location?: string
  price?: string
  sellback?: string
  capacity?: string
  furnishingSlots?: string
  effect?: string
  obtainMethods?: ObtainVariant[]
  rarity?: string
  itemType?: string
  notes?: string
  alsoSee?: AlsoSeeRef[]
  tags: string[]
  daRequired: true
  dcRequired?: boolean
  hasFree?: boolean
  hasSpecialEffect?: boolean
  isRare?: boolean
  isSeasonal?: boolean
  isSpecialOffer?: boolean
  retired?: boolean
}

export type HousingFamily = ItemFamily & {
  type: 'housing'
  subtype: HousingSubtype
}

export type HousingEntry = HousingItem | HousingFamily

export function isHousingFamily(entry: HousingEntry): entry is HousingFamily {
  return 'levelVariants' in entry
}

export interface HousingFilters {
  query?: string
  access?: Array<'multiple' | 'dc'>
  excludeAccess?: Array<'multiple' | 'dc'>
  categories?: Array<'effect' | 'rare' | 'seasonal' | 'retired'>
  excludeCategories?: Array<'effect' | 'rare' | 'seasonal' | 'retired'>
}

export const HOUSING_SUBTYPES: HousingSubtypeMeta[] = [
  {
    subtype: 'house',
    label: 'Houses',
    route: '/houses',
    dataFiles: ['housing-houses.json'],
    shortDescription:
      'Houses modify the appearance of your house, as well as its total item capacity; own any house style to obtain the Home Owner badge.',
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=21302540',
  },
  {
    subtype: 'background',
    label: 'Backgrounds',
    route: '/backgrounds',
    dataFiles: ['housing-backgrounds.json'],
    shortDescription:
      'Backgrounds modify the location of your house; incompatible with certain house styles.',
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=21302544',
  },
  {
    subtype: 'floor',
    label: 'Floors',
    route: '/floors',
    dataFiles: ['housing-floors.json'],
    shortDescription:
      'Floors modify the internal appearance of your house; incompatible with certain house styles.',
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=21302550',
  },
  {
    subtype: 'rug',
    label: 'Rugs',
    route: '/rugs',
    dataFiles: ['housing-rugs.json'],
    shortDescription:
      'Rugs can be added to furnish slots on the floor inside your house; certain Rugs provide a special effect.',
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=21302552',
  },
  {
    subtype: 'shrub',
    label: 'Shrubs',
    route: '/shrubs',
    dataFiles: ['housing-shrubs.json'],
    shortDescription:
      'Shrubs can be added to furnish slots outside your house; certain Shrubs provide a special effect.',
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=21302553',
  },
  {
    subtype: 'stuff',
    label: 'Stuff',
    route: '/stuff',
    dataFiles: ['housing-stuff.json'],
    shortDescription:
      'Stuff can be added to furnish slots inside your house; certain Stuff provides a special effect.',
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=21302554',
  },
  {
    subtype: 'wall-item',
    label: 'Wall Items',
    route: '/wall-items',
    dataFiles: ['housing-wall-items.json'],
    shortDescription:
      'Wall Items can be added to furnish slots on the walls inside your house; certain Wall Items provide a special effect.',
    sourceUrl: 'https://forums2.battleon.com/f/fb.asp?m=21302557',
  },
]
