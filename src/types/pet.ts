export type EntryType = 'pet' | 'guest'

export type PriceType = 'gold' | 'dc' | 'dm' | 'free' | 'merge'

// ─── Guest-Specific Stat Interfaces ──────────────────────────────────────────

export interface GuestCharacterStats {
  str?: string   // "0" or formula like "As player"
  dex?: string
  int?: string
  cha?: string
  luk?: string
  end?: string
  wis?: string
}

export interface GuestOffenseStats {
  boost?: string     // "0%"
  bonus?: string     // "100"
  crit?: string      // "5"
}

export interface GuestDamageMultipliers {
  nonCrit?: string   // "100%"
  dex?: string       // "100%"
  dot?: string       // "100%"
  crit?: string      // "175%"
}

export interface GuestDefenseStats {
  melee?: string     // "5"
  pierce?: string    // "0"
  magic?: string     // "5"
  block?: string     // "0"
  parry?: string     // "0"
  dodge?: string     // "0"
}

export interface GuestDamageReduction {
  nonCrit?: string   // "0%"
  dot?: string       // "0%"
  crit?: string      // "0%"
}

export interface GuestStats {
  // Basic Info
  level?: string           // "As player" or numeric
  damage?: string          // "Scaled"
  damageType?: 'Melee' | 'Magic' | 'Pierce'
  element?: string         // "Darkness"
  
  // HP/MP
  hp?: string              // "As player, less END bonus"
  mp?: string              // "As player, less WIS bonus"
  
  // Stat sections
  characterStats?: GuestCharacterStats
  offense?: GuestOffenseStats
  damageMultipliers?: GuestDamageMultipliers
  defense?: GuestDefenseStats
  damageReduction?: GuestDamageReduction
  resistances?: Record<string, string>  // Element code → value
}

export interface ObtainMethod {
  location: string         // "Grams Pets", "Cysero's Shop", "Chasing Answers"
  priceType: PriceType     // For filtering and DC/DM logo display
  requirements?: string    // "Completion of Hawk in the Sky to unlock"
  price?: string           // "500 Gold", "200 Dragon Coins", "N/A" (optional - not used for guests)
  requiredItems?: string   // "1 Prince Linus & 1 Royal Penguin Shrink Ray"
  sellback?: string        // "0 Gold", "125 Gold" (optional - not used for guests)
  // Per-method access flags (optional - only present if detected in that method's context)
  daRequired?: boolean     // true if DA tag appears near this specific obtain method
  dcRequired?: boolean     // true if DC tag appears near this specific obtain method (not used for guests)
  dmRequired?: boolean     // true if DM tag appears near this specific obtain method (not used for guests)
}

export interface Attack {
  name: string             // "Attack Type 1", "Attack Type 2 / 2.1"
  description: string      // Full description text
  images?: string[]        // URLs to attack animation images
  notes?: string[]         // Sub-bullet mechanic notes
}

export interface GuestAttack {
  name: string             // "DragonLord's Fury", "Pierce", "Attack"
  description?: string     // Italic description text (multiline supported)
  requirements?: string    // "Successful 'Pierce' to unlock" - hide if "None"
  effect: string           // Effect description text
  manaCost: string         // "25", "0"
  cooldown: string         // "19", "0"
  damageType: string       // "Magic", "Melee", "Pierce", "N/A"
  element: string          // "Energy", "Fire", "???"
  buttonImageUrl?: string  // URL to skill button icon
  appearanceUrl?: string   // URL to appearance/animation image (from hyperlink)
}

export interface Evolution {
  combineWith: string      // "Royal Penguin Shrink Ray"
  resultName: string       // "Emperor Linus (Normal)"
  resultSlug: string       // "pet-emperor-linus-normal"
  resultType: EntryType    // 'pet' or 'guest'
}

export interface AlsoSeeRef {
  name: string             // "Linus"
  slug: string             // "pet-linus"
  type: EntryType          // 'pet' or 'guest'
}

export interface Pet {
  // Identity
  id: string
  name: string
  slug: string             // Type-prefixed: "pet-king-linus", "guest-artix"
  type: EntryType

  // Description
  description: string      // Flavour text
  daRequired: boolean
  dcRequired?: boolean     // true if DC logo image present in forum post
  dmRequired?: boolean     // true if DM logo image present (Defender's Medals)

  // Categories (Level 2 filters)
  isTemp?: boolean         // Temporary availability
  isRare?: boolean         // Rare item
  isSeasonal?: boolean     // Seasonal item
  isSpecialOffer?: boolean // Special offer item
  retired?: boolean        // Retired/unavailable

  // Elements — array since a pet can have multiple
  elements: string[]       // Element codes: ["ICE"] or ["ICE", "FIR"]
  traits: string[]         // Behavioural trait codes: ["SHR", "W/S"] (formerly specialMarkers)

  // Stats
  level: string            // "19" or "19-25"
  damage: string           // "2-16"
  stats: string            // "Crit +3" or "None"
  statsType?: 'petStats' | 'bonuses'  // Dynamic stat type for header display
  resists: string          // "None" or "Fire +10"

  // Acquisition
  obtainMethods: ObtainMethod[]

  // Combat
  attacks: Attack[]
  rarity: string           // "19"

  // Evolution paths
  evolutions: Evolution[]

  // Metadata
  releaseDate: string      // "September 15th, 2017" — required from Chronology
  imageUrl?: string        // Full pet image URL
  alternativeImages?: Array<{ url: string; caption: string }>  // Alternative images with captions
  forumUrl: string
  notes?: string           // Bullet-separated notes with " • "
  alsoSee: AlsoSeeRef[]   // Explicit typed cross-references

  // Search indexing
  tags: string[]
}

export interface PetFilters {
  query?: string
  type?: EntryType[]       // Which segment(s) are active
  elements?: string[]      // Multi-select element codes (OR logic)
  access?: ('multi' | 'free' | 'dc' | 'dm' | 'da' | 'merge')[]  // Level 1 multi-select access filters
  categories?: ('temp' | 'rare' | 'seasonal' | 'special-offer' | 'retired')[]  // Level 2 multi-select
}

// ─── Guest Type (extends Pet with structured stats) ──────────────────────────

export interface Guest extends Omit<Pet, 'attacks' | 'damage' | 'stats' | 'statsType' | 'rarity'> {
  type: 'guest'
  guestStats: GuestStats            // Structured guest stats (always present for guests)
  attacks: GuestAttack[]            // Attacks with button images and structured data
  alternativeImages?: Array<{       // Alt appearances with captions
    url: string
    caption?: string
  }>
}
