import type { AlsoSeeRef, ItemFamily, ObtainVariant } from './item'

export type WeaponSubtype = 'sword-axe-mace' | 'staff-wand' | 'dagger' | 'scythe'

export interface WeaponSubtypeMeta {
  subtype: WeaponSubtype
  label: string
  route: string
  dataFiles: string[]
  shortDescription: string
}

export interface Weapon {
  id: string
  name: string
  slug: string
  type: 'weapon'
  subtype: WeaponSubtype
  description: string
  forumUrl: string
  releaseDate: string
  imageUrl?: string
  alternativeImages?: Array<{ url: string; caption: string }>
  elements: string[]
  level?: string
  damage?: string
  stats?: string
  resists?: string
  ability?: string
  rarity?: string
  obtainMethods: ObtainVariant[]
  notes?: string
  alsoSee?: AlsoSeeRef[]
  tags: string[]
  daRequired: boolean
  dcRequired?: boolean
  dmRequired?: boolean
  isTemp?: boolean
  isCosmetic?: boolean
  isRare?: boolean
  isSeasonal?: boolean
  isSpecialOffer?: boolean
  retired?: boolean
}

export type WeaponFamily = ItemFamily & {
  type: 'weapon'
  subtype: WeaponSubtype
}

export type WeaponEntry = Weapon | WeaponFamily

export interface WeaponFilters {
  query?: string
  access?: Array<'multi' | 'free' | 'merge' | 'dc' | 'dm' | 'da'>
  categories?: Array<'cosmetic' | 'temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired'>
  elements?: string[]
}

export const WEAPON_SUBTYPES: WeaponSubtypeMeta[] = [
  {
    subtype: 'sword-axe-mace',
    label: 'Swords, Axes, & Maces',
    route: '/swords-axes-maces',
    dataFiles: [
      'weapons-swords-axes-maces-a-g.json',
      'weapons-swords-axes-maces-h-n.json',
      'weapons-swords-axes-maces-o-z.json',
    ],
    shortDescription:
      "Melee weapons typically used by players of Warrior base class; damage is increased by player's STR stat.",
  },
  {
    subtype: 'staff-wand',
    label: 'Staves & Wands',
    route: '/staves-wands',
    dataFiles: [
      'weapons-staves-wands-a-g.json',
      'weapons-staves-wands-h-n.json',
      'weapons-staves-wands-o-z.json',
    ],
    shortDescription:
      "Magic weapons typically used by players of Mage base class; damage is increased by player's INT stat.",
  },
  {
    subtype: 'dagger',
    label: 'Daggers',
    route: '/daggers',
    dataFiles: ['weapons-daggers-a-g.json', 'weapons-daggers-h-n.json', 'weapons-daggers-o-z.json'],
    shortDescription:
      "Pierce weapons typically used by players of Rogue base class; damage is increased by player's DEX stat.",
  },
  {
    subtype: 'scythe',
    label: 'Scythes',
    route: '/scythes',
    dataFiles: ['weapons-scythes-a-j.json', 'weapons-scythes-k-z.json'],
    shortDescription:
      "Versatile weapons used by players of any base class; damage type corresponds to player's highest trained INT (Magic), DEX (Pierce), or STR (Melee) stat.",
  },
]

export const WEAPON_SUBTYPE_BY_ROUTE = new Map(WEAPON_SUBTYPES.map((meta) => [meta.route, meta]))

export function isWeaponFamily(entry: WeaponEntry): entry is WeaponFamily {
  return 'levelVariants' in entry && 'familyName' in entry
}
