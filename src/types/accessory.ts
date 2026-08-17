import type { AlsoSeeRef, ItemFamily, ObtainVariant } from './item'
import type { GuestAttack } from './pet'
import type { ArmorCustomizationInfo } from '../utils/armorCustomization'

export type AccessorySubtype =
  'artifact' | 'belt' | 'bracer' | 'cape-wing' | 'helm' | 'necklace' | 'ring' | 'trinket'

export interface AccessorySubtypeMeta {
  subtype: AccessorySubtype
  label: string
  route: string
  dataFiles: string[]
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
  trinketSkillEffectTypes?: string[]
  rarity?: string
  itemType?: string
  equipSpot?: string
  modifies?: string
  armorCustomization?: ArmorCustomizationInfo
  category?: string
  obtainMethods: ObtainVariant[]
  notes?: string
  alsoSee?: AlsoSeeRef[]
  tags: string[]
  daRequired: boolean
  dcRequired?: boolean
  dmRequired?: boolean
  isTemp?: boolean
  isCosmetic?: boolean
  hasArmorCustomization?: boolean
  isRare?: boolean
  isSeasonal?: boolean
  isSpecialOffer?: boolean
  retired?: boolean
}

export type AccessoryFamily = ItemFamily & {
  type: 'accessory'
  subtype: AccessorySubtype
  modifies?: string
  armorCustomization?: ArmorCustomizationInfo
  hasArmorCustomization?: boolean
  trinketSkillEffectTypes?: string[]
}

export type AccessoryEntry = Accessory | AccessoryFamily

export interface AccessoryFilters {
  query?: string
  access?: Array<'multi' | 'free' | 'merge' | 'dc' | 'dm' | 'da'>
  excludeAccess?: Array<'multi' | 'free' | 'merge' | 'dc' | 'dm' | 'da'>
  categories?: Array<
    'armor-customization' | 'cosmetic' | 'temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired'
  >
  excludeCategories?: Array<
    'armor-customization' | 'cosmetic' | 'temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired'
  >
  elements?: string[]
  excludeElements?: string[]
}

export const ACCESSORY_SUBTYPES: AccessorySubtypeMeta[] = [
  {
    subtype: 'artifact',
    label: 'Artifacts',
    route: '/artifacts',
    dataFiles: ['artifacts.json'],
    shortDescription:
      'Occupies another equip spot, dependant on item type; cannot be equipped or unequipped during battle.',
  },
  {
    subtype: 'belt',
    label: 'Belts',
    route: '/belts',
    dataFiles: ['belts.json'],
    shortDescription: 'Occupies Waist equip spot; can be equipped or unequipped during battle.',
  },
  {
    subtype: 'bracer',
    label: 'Bracers',
    route: '/bracers',
    dataFiles: ['bracers.json'],
    shortDescription:
      'Occupies Wrist equip spot; can be equipped or unequipped during battle, unless attempted to be replaced by an Artifact.',
  },
  {
    subtype: 'cape-wing',
    label: 'Capes & Wings',
    route: '/capes-wings',
    dataFiles: ['capes-wings-a-l.json', 'capes-wings-m-z.json'],
    shortDescription:
      'Occupies Back equip spot; can be equipped or unequipped during battle, unless attempted to be replaced by an Artifact.',
  },
  {
    subtype: 'helm',
    label: 'Helms',
    route: '/helms',
    dataFiles: ['helms-a-l.json', 'helms-m-z.json'],
    shortDescription:
      'Occupies Head equip spot; can be equipped or unequipped during battle, unless attempted to be replaced by an Artifact.',
  },
  {
    subtype: 'necklace',
    label: 'Necklaces',
    route: '/necklaces',
    dataFiles: ['necklaces.json'],
    shortDescription:
      'Occupies Neck equip spot; can be equipped or unequipped during battle, unless attempted to be replaced by an Artifact.',
  },
  {
    subtype: 'ring',
    label: 'Rings',
    route: '/rings',
    dataFiles: ['rings.json'],
    shortDescription: 'Occupies Finger equip spot; can be equipped or unequipped during battle.',
  },
  {
    subtype: 'trinket',
    label: 'Trinkets',
    route: '/trinkets',
    dataFiles: ['trinkets.json'],
    shortDescription:
      'Occupies Trinket equip spot; cannot be equipped or unequipped during battle.',
  },
]

export const ACCESSORY_SUBTYPE_BY_ROUTE = new Map(
  ACCESSORY_SUBTYPES.map((meta) => [meta.route, meta])
)

export function isAccessoryFamily(entry: AccessoryEntry): entry is AccessoryFamily {
  return 'levelVariants' in entry && 'familyName' in entry
}
