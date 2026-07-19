import type { ItemFamily, ObtainVariant } from './item'
import type { GuestAttack } from './pet'

export type AccessorySubtype =
  | 'artifact'
  | 'belt'
  | 'bracer'
  | 'cape-wing'
  | 'helm'
  | 'necklace'
  | 'ring'
  | 'trinket'

export interface AccessorySubtypeMeta {
  subtype: AccessorySubtype
  label: string
  route: string
  dataFile: string
  shortDescription: string
}

export interface Accessory {
  id: string
  name: string
  slug: string
  type: 'accessory'
  subtype: AccessorySubtype
  description: string
  forumUrl: string
  releaseDate: string
  imageUrl?: string
  alternativeImages?: Array<{ url: string; caption: string }>
  elements: string[]
  level?: string
  stats?: string
  resists?: string
  ability?: string
  abilityUrl?: string
  attacks?: GuestAttack[]
  rarity?: string
  itemType?: string
  equipSpot?: string
  modifies?: string
  category?: string
  obtainMethods: ObtainVariant[]
  notes?: string
  tags: string[]
  daRequired: boolean
  dcRequired?: boolean
  dmRequired?: boolean
  isTemp?: boolean
  isRare?: boolean
  isSeasonal?: boolean
  isSpecialOffer?: boolean
  retired?: boolean
}

export type AccessoryFamily = ItemFamily & {
  type: 'accessory'
  subtype: AccessorySubtype
  modifies?: string
}

export type AccessoryEntry = Accessory | AccessoryFamily

export interface AccessoryFilters {
  query?: string
  access?: Array<'multi' | 'free' | 'merge' | 'dc' | 'dm' | 'da'>
  categories?: Array<'temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired'>
  elements?: string[]
}

export const ACCESSORY_SUBTYPES: AccessorySubtypeMeta[] = [
  {
    subtype: 'artifact',
    label: 'Artifacts',
    route: '/artifacts',
    dataFile: 'artifacts.json',
    shortDescription: 'Magical accessories and artifact-tier equipment.',
  },
  {
    subtype: 'belt',
    label: 'Belts',
    route: '/belts',
    dataFile: 'belts.json',
    shortDescription: 'Waist-slot accessories with stat or utility effects.',
  },
  {
    subtype: 'bracer',
    label: 'Bracers',
    route: '/bracers',
    dataFile: 'bracers.json',
    shortDescription: 'Arm-slot accessories including family and branch variants.',
  },
  {
    subtype: 'cape-wing',
    label: 'Capes & Wings',
    route: '/capes-wings',
    dataFile: 'capes-wings.json',
    shortDescription: 'Back-slot cosmetic and combat accessories.',
  },
  {
    subtype: 'helm',
    label: 'Helms',
    route: '/helms',
    dataFile: 'helms.json',
    shortDescription: 'Head-slot accessories, helms, masks, and circlets.',
  },
  {
    subtype: 'necklace',
    label: 'Necklaces',
    route: '/necklaces',
    dataFile: 'necklaces.json',
    shortDescription: 'Neck-slot accessories with passive bonuses and utility.',
  },
  {
    subtype: 'ring',
    label: 'Rings',
    route: '/rings',
    dataFile: 'rings.json',
    shortDescription: 'Ring-slot accessories, from simple stat boosts to families.',
  },
  {
    subtype: 'trinket',
    label: 'Trinkets',
    route: '/trinkets',
    dataFile: 'trinkets.json',
    shortDescription: 'Trinkets, gadgets, and activated accessory-style items.',
  },
]

export const ACCESSORY_SUBTYPE_BY_ROUTE = new Map(
  ACCESSORY_SUBTYPES.map(meta => [meta.route, meta])
)

export function isAccessoryFamily(entry: AccessoryEntry): entry is AccessoryFamily {
  return 'levelVariants' in entry && 'familyName' in entry
}
