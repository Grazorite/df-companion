export type EntryType = 'pet' | 'guest'

export type PriceType = 'gold' | 'dc' | 'dm' | 'free' | 'merge'

export interface ObtainMethod {
  location: string         // "Grams Pets", "Cysero's Shop"
  price: string            // "500 Gold", "200 Dragon Coins", "N/A"
  priceType: PriceType     // For filtering and DC/DM logo display
  requiredItems?: string   // "1 Prince Linus & 1 Royal Penguin Shrink Ray"
  sellback: string         // "0 Gold", "125 Gold"
  // Per-method access flags (optional - only present if detected in that method's context)
  daRequired?: boolean     // true if DA tag appears near this specific obtain method
  dcRequired?: boolean     // true if DC tag appears near this specific obtain method
  dmRequired?: boolean     // true if DM tag appears near this specific obtain method
}

export interface Attack {
  name: string             // "Attack Type 1", "Attack Type 2 / 2.1"
  description: string      // Full description text
  images?: string[]        // URLs to attack animation images
  notes?: string[]         // Sub-bullet mechanic notes
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
