/**
 * Multi-Variant Item Type System
 * 
 * This module defines the hierarchical type system for items that have multiple
 * level variants and/or multiple obtain methods within a single forum thread.
 * 
 * Example: Goldfish Knight (I-VII)
 * - 7 level variants (I through VII)
 * - Each level has 2 obtain variants: free quest drop and DC purchase
 * - DA requirement varies: free option requires DA at IV-VII, DC option never requires DA
 * - Family flags: hasDA=true, hasDC=true, hasFree=true (all three access methods exist)
 */

/**
 * Price type classification for obtain methods.
 * 
 * - free: Price is "N/A"/"0 Gold"/"Free" with NO required items
 *   Example: Quest reward pets, Goldfish Knight I-VII (free option)
 * 
 * - merge: Price is "N/A" but HAS required items (merge shop)
 *   Example: DM shop items (requires Defender's Medals), crafted items
 * 
 * - gold: Price is in Gold currency (standard in-game currency)
 *   Example: "500 Gold"
 * 
 * - dc: Price is in Dragon Coins (premium currency purchased with real money)
 *   Example: "150 Dragon Coins", Goldfish Knight I-VII (DC option)
 * 
 * - dm: Price is in Defender's Medals (earned currency from wars)
 *   Example: "75 Defender's Medals"
 */
import type { GuestAttack, GuestStats } from './pet'

export type PriceType = 'gold' | 'dc' | 'dm' | 'free' | 'merge'

/**
 * Item type classification
 * 
 * Used to identify what category an item belongs to across the application.
 * Extensible to support future content sections.
 */
export type ItemType = 'pet' | 'guest' | 'weapon' | 'armor' | 'trinket' | 'accessory'

/**
 * Attack interface (shared between Pet and ItemFamily)
 * 
 * Represents a combat ability with description and optional animation images.
 */
export interface Attack {
  name: string             // "Attack Type 1", "Attack Type 2 / 2.1"
  description: string      // Full description text
  images?: string[]        // URLs to attack animation images
  notes?: string[]         // Sub-bullet mechanic notes
}

export type VariantAttack = Attack | GuestAttack

export interface AlternativeImage {
  url: string
  caption: string
}

export interface FamilySourceRef {
  url: string
  title: string
  variantLabel?: string
  isPrimary?: boolean
}

/**
 * Also See reference (shared between Pet and ItemFamily)
 * 
 * Typed cross-reference to related items with explicit type information.
 */
export interface AlsoSeeRef {
  name: string             // "Linus"
  slug: string             // "pet-linus"
  type: ItemType           // Item type for routing
}

/**
 * ObtainVariant represents a single acquisition method at a specific level.
 * 
 * Key insight from Goldfish Knight:
 * DA requirement is stored PER-OBTAIN, not per-level. At level IV+, the free
 * option requires DA but the DC option does NOT. This is why daRequired must
 * be a property of ObtainVariant, not LevelVariant.
 * 
 * @example
 * // Goldfish Knight IV - Free option (requires DA)
 * {
 *   location: "Efficient Housework",
 *   price: "N/A",
 *   priceType: "free",
 *   daRequired: true,
 *   sellback: "15 Gold"
 * }
 * 
 * @example
 * // Goldfish Knight IV - DC option (no DA required)
 * {
 *   location: "EH Loot for DCs",
 *   price: "150 Dragon Coins",
 *   priceType: "dc",
 *   daRequired: false,
 *   dcRequired: true,
 *   sellback: "135 DC before 24h, 38 DC after"
 * }
 */
export interface ObtainVariant {
  location: string           // "Efficient Housework", "EH Loot for DCs"
  locationUrl?: string       // Forum link to location thread (optional)
  price: string              // "N/A", "150 Dragon Coins", "500 Gold"
  priceType: PriceType       // Computed from price + requiredItems
  sellback?: string          // "9 Gold", "135 DC before 24h, 38 DC after"
  requirements?: string      // "Completion of Hawk in the Sky to unlock" - hide if "None"
  
  /**
   * DA Required flag
   * 
   * CRITICAL: This is per-obtain-variant, NOT per-level or per-item.
   * 
   * Abbreviations:
   * - DA = Dragon Amulet (premium account status, one-time purchase)
   * 
   * Example: Goldfish Knight demonstrates why this matters:
   * - Level I-III free option: daRequired=false
   * - Level IV-VII free option: daRequired=true  
   * - Level I-VII DC option: daRequired=false (always)
   */
  daRequired: boolean
  
  /**
   * DC Required flag
   * 
   * Computed as true when priceType='dc'
   * 
   * Abbreviations:
   * - DC = Dragon Coins (premium currency purchased with real money)
   */
  dcRequired?: boolean
  
  /**
   * DM Required flag
   * 
   * Computed as true when priceType='dm'
   * 
   * Abbreviations:
   * - DM = Defender's Medals (earned currency from participating in wars)
   */
  dmRequired?: boolean
  
  requiredItems?: string     // "1 Prince Linus & 1 Royal Penguin Shrink Ray"
}

/**
 * LevelVariant represents an item at a specific level.
 * 
 * Each level has its own damage, stats, and possibly multiple obtain methods.
 * Level-specific overrides allow for variations in element, attacks, etc.
 * 
 * @example
 * // Goldfish Knight IV
 * {
 *   levelNumber: 4,
 *   levelDisplay: "IV",
 *   actualLevel: 60,
 *   name: "Goldfish Knight IV",
 *   damage: "17-17",
 *   stats: "Crit +6, Bonus +6",
 *   obtainVariants: [
 *     { location: "Efficient Housework", price: "N/A", priceType: "free", daRequired: true, ... },
 *     { location: "EH Loot for DCs", price: "150 Dragon Coins", priceType: "dc", daRequired: false, ... }
 *   ]
 * }
 */
export interface LevelVariant {
  levelNumber: number        // 1, 2, 3... (parsed from roman or numeric)
  levelDisplay: string       // "I", "II", "III" or "30", "45", "60"
  actualLevel?: number       // Game level if different (Level I = Lv 30)
  variantName?: string       // "Normal", "D-Coins", "Resource" for same-level branch variants
  name: string               // "Goldfish Knight IV" - for search indexing
  damage: string             // "17-17"
  stats: string              // "Crit +6, Bonus +6"
  statsType?: 'petStats' | 'bonuses'  // "petStats" for Pet's Stats, "bonuses" for Bonuses (player bonuses)
  
  // Obtain variants at THIS level (can have different DA requirements!)
  obtainVariants: ObtainVariant[]
  
  // Override shared fields if they differ at this level
  sourceUrl?: string
  description?: string
  imageUrl?: string
  alternativeImages?: AlternativeImage[]
  element?: string           // Only if different from shared.element
  resists?: string           // Only if different from shared.resists
  rarity?: string            // Only if different from shared.rarity
  attacks?: VariantAttack[]  // Only if attacks differ at this level
  guestStats?: GuestStats
  notes?: string             // Level-specific notes
}

/**
 * SharedData holds information that is identical across all level variants.
 * 
 * This avoids duplicating description, image, element, attacks, etc. when they
 * don't change across levels. If a level has different data, it overrides via
 * the level-specific fields in LevelVariant.
 * 
 * @example
 * // Goldfish Knight shared data
 * const sharedData: SharedData = {
 *   description: "You found this other completely different fish...",
 *   ability: "Can recover your mana based on item's level and your CHA!",
 *   imageUrl: "https://media.artix.com/encyc/df/Goldfish_Knight.png",
 *   element: "Water",
 *   resists: "None",
 *   rarity: "1",
 *   attacks: attackObjects,
 *   notes: "Attack Type 2 will only be used on every fourth turn",
 *   alsoSee: [{ name: "Goldfish", slug: "pet-goldfish", type: "pet" }]
 * }
 */
export interface SharedData {
  description: string        // Shared flavour text
  ability?: string           // "Can recover mana based on level and CHA"
  imageUrl?: string          // Shared image (often in last post of multi-post threads)
  alternativeImages?: AlternativeImage[]  // Alternative images with captions
  element?: string           // "Water" - when same for all levels
  resists?: string           // "None" - when same for all levels  
  rarity?: string            // "1" - when same for all levels
  attacks?: VariantAttack[]  // When attacks are same for all levels
  notes?: string             // Shared notes (bullet-separated with " • ")
  alsoSee?: AlsoSeeRef[]     // Related items
}

/**
 * ItemFamily represents the complete multi-variant item structure.
 * 
 * This is the top-level container that holds shared data and all level variants.
 * Family-level flags (hasDA, hasDC, etc.) are computed from ALL obtain variants
 * across ALL levels, enabling efficient filtering.
 * 
 * Single-variant items (most existing pets) use the same structure with arrays
 * of length 1, ensuring backward compatibility.
 * 
 * @example
 * // Goldfish Knight (complete family)
 * {
 *   id: "pet-goldfish-knight",
 *   familyName: "Goldfish Knight",
 *   slug: "pet-goldfish-knight",
 *   type: "pet",
 *   forumUrl: "https://forums2.battleon.com/f/tm.asp?m=12345678",
 *   shared: { description: "...", imageUrl: "...", element: "Water", ... },
 *   levelVariants: [
 *     { levelNumber: 1, levelDisplay: "I", ... obtainVariants: [...] },
 *     { levelNumber: 2, levelDisplay: "II", ... obtainVariants: [...] },
 *     // ... through VII
 *   ],
 *   tags: ["water", "fish", "knight"],
 *   hasDA: true,     // Because free option at IV-VII requires DA
 *   hasDC: true,     // Because DC option exists
 *   hasDM: false,    // No DM option
 *   hasFree: true,   // Because free option exists
 *   hasMerge: false, // No merge option
 *   levelRange: "I-VII",
 *   elements: ["Water"]
 * }
 */
export interface ItemFamily {
  // Identity
  id: string
  familyName: string         // "Goldfish Knight" (without level suffix)
  familySubtitle?: string    // Optional short qualifier shown in variant-driven families
  slug: string               // Type-prefixed: "pet-goldfish-knight"
  aliasSlugs?: string[]      // Legacy or merged slugs that should resolve to this family
  type: ItemType
  forumUrl: string           // Thread URL
  familyOrigin?: 'single-thread' | 'same-thread-multi-post' | 'cross-post'
  familySources?: FamilySourceRef[]
  
  // Shared data (same across all levels)
  shared: SharedData
  
  // Level variants (each may have multiple obtain variants)
  levelVariants: LevelVariant[]
  
  // Type-specific metadata (optional extensions for future item types)
  itemType?: string          // "Scythe", "Sword" — for weapons
  damageType?: string        // "Magic/Pierce/Melee" — for weapons
  equipSlot?: string         // "Weapon", "Helm" — for equippables
  category?: string          // "Weapon", "Armor"
  
  // Release date (from Chronology)
  releaseDate?: string       // "September 15th, 2017"
  
  // Search tags
  tags: string[]
  
  /**
   * Computed family-level access flags
   * 
   * These are computed from ALL obtain variants across ALL level variants.
   * Used for efficient filtering in the UI.
   * 
   * Important: An item can have MULTIPLE flags true simultaneously.
   * Example: Goldfish Knight has hasDA + hasDC + hasFree all true because:
   * - hasDA=true: free option at IV-VII requires DA
   * - hasDC=true: DC purchase option exists at all levels
   * - hasFree=true: free option exists at all levels (I-III without DA, IV-VII with DA)
   * 
   * Abbreviations:
   * - DA = Dragon Amulet (premium account status)
   * - DC = Dragon Coins (premium currency)
   * - DM = Defender's Medals (war currency)
   */
  hasDA: boolean             // ANY obtain variant has daRequired=true
  hasDC: boolean             // ANY obtain variant has priceType='dc'
  hasDM: boolean             // ANY obtain variant has priceType='dm'
  hasFree: boolean           // ANY obtain variant has priceType='free'
  hasMerge: boolean          // ANY obtain variant has priceType='merge'
  
  /**
   * Category flags (Level 2 filters)
   * 
   * Computed from thread-level detection (image tags in forum post).
   * An entry can have multiple L2 categories (e.g., both Seasonal AND Rare).
   */
  isTemp?: boolean           // Temporary availability
  isRare?: boolean           // Rare item
  isSeasonal?: boolean       // Seasonal item
  isSpecialOffer?: boolean   // Special offer item
  retired?: boolean          // Retired/unavailable
  
  /**
   * Level range display string
   * 
   * For roman numeral ranges: "I-VII", "30-90"
   * For multi-post variants: Original name from forums (e.g., "(Kitten, Cat)")
   * For single-level items: "1" or "I"
   */
  levelRange: string
  
  /**
   * Marks multi-post families (like Baron (Kitten, Cat))
   * 
   * When true, levelRange should not be appended to display name.
   * The familyName already contains the full variant list.
   */
  isMultiPost?: boolean
  
  /**
   * All unique elements across levels
   * 
   * Most items have a single element, but this array handles edge cases where
   * element varies by level (would use level-specific override).
   */
  elements: string[]
}
