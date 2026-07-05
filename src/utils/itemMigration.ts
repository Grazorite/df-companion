/**
 * Item Migration Utilities
 * 
 * Converters between the existing Pet type and the new ItemFamily hierarchical
 * structure. Enables backward compatibility while transitioning to multi-variant
 * support.
 */

import type { Pet, Guest, AlsoSeeRef as PetAlsoSeeRef } from '../types/pet'
import type { ItemFamily, ObtainVariant } from '../types/item'
import { computeFamilyFlags, normalizeLevel } from './variantHelpers'

/**
 * Convert existing Pet object to ItemFamily structure.
 * 
 * Wraps a single-variant pet in the hierarchical structure with arrays of length 1.
 * This ensures backward compatibility - existing pets display unchanged but use
 * the new data model internally.
 * 
 * Process:
 * 1. Extract shared data (description, image, element, attacks, etc.)
 * 2. Create single LevelVariant with obtainVariants from Pet.obtainMethods
 * 3. Compute family-level flags (hasDA, hasDC, etc.)
 * 4. Ensure isSingleVariant() returns true for result
 * 
 * @param pet - Existing Pet object
 * @returns ItemFamily with single level and obtain variant(s)
 * 
 * @example
 * const pet: Pet = {
 *   id: "pet-linus",
 *   name: "Linus",
 *   level: "30",
 *   daRequired: false,
 *   obtainMethods: [{ location: "Grams Pets", price: "500 Gold", ... }],
 *   ...
 * }
 * const family = petToItemFamily(pet)
 * // family.levelVariants.length === 1
 * // family.levelVariants[0].obtainVariants.length === 1
 * // isSingleVariant(family) === true
 */
export function petToItemFamily(pet: Pet): ItemFamily {
  // Parse level
  const levelParsed = normalizeLevel(pet.level)
  
  // Convert obtainMethods to ObtainVariants
  const obtainVariants: ObtainVariant[] = pet.obtainMethods.map(method => ({
    location: method.location,
    locationUrl: undefined, // Not present in current Pet schema
    price: method.price ?? 'N/A',
    priceType: method.priceType, // Already computed in Pet
    sellback: method.sellback,
    daRequired: pet.daRequired, // Pet-level flag applies to all obtain methods
    dcRequired: pet.dcRequired,
    dmRequired: pet.dmRequired,
    requiredItems: method.requiredItems,
  }))
  
  // Build ItemFamily structure
  const family: ItemFamily = {
    // Identity
    id: pet.id,
    familyName: pet.name, // No level suffix for single-variant
    slug: pet.slug,
    type: pet.type,
    forumUrl: pet.forumUrl,
    
    // Shared data (stored once)
    shared: {
      description: pet.description,
      ability: undefined, // Not present in current Pet schema
      imageUrl: pet.imageUrl,
      element: pet.elements[0], // Take first element if multiple
      resists: pet.resists,
      rarity: pet.rarity,
      attacks: pet.attacks.length > 0 ? pet.attacks : undefined,
      notes: pet.notes,
      alsoSee: pet.alsoSee,
    },
    
    // Single level variant
    levelVariants: [
      {
        levelNumber: levelParsed.number,
        levelDisplay: levelParsed.display,
        actualLevel: undefined, // Not present in current Pet schema
        name: pet.name,
        damage: pet.damage,
        stats: pet.stats,
        obtainVariants,
        sourceUrl: pet.forumUrl,
        description: pet.description,
        ...(pet.imageUrl ? { imageUrl: pet.imageUrl } : {}),
        ...(pet.alternativeImages ? { alternativeImages: pet.alternativeImages } : {}),
        ...('guestStats' in pet ? { guestStats: (pet as unknown as Guest).guestStats } : {}),
        ...(pet.attacks.length > 0 ? { attacks: pet.attacks } : {}),
        ...(pet.notes ? { notes: pet.notes } : {}),
        // No overrides needed for single-variant
      },
    ],
    
    // Type-specific (pets don't have these)
    itemType: undefined,
    damageType: undefined,
    equipSlot: undefined,
    category: undefined,
    
    // Metadata
    releaseDate: pet.releaseDate,
    tags: pet.tags,
    
    // Computed flags (will be set by computeFamilyFlags)
    hasDA: false,
    hasDC: false,
    hasDM: false,
    hasFree: false,
    hasMerge: false,
    levelRange: '',
    elements: [],
  }
  
  // Compute family-level flags
  return computeFamilyFlags(family)
}

/**
 * Convert ItemFamily back to Pet structure (backward compatibility).
 * 
 * Takes the first level variant and first obtain variant to reconstruct a flat Pet.
 * Used when legacy code expects a Pet object but we have an ItemFamily.
 * 
 * Important: This loses multi-variant data! Only use for single-variant families
 * or when you explicitly want the first variant only.
 * 
 * @param family - ItemFamily object
 * @returns Pet object (flattened)
 * 
 * @example
 * const family: ItemFamily = { ... } // Single-variant family
 * const pet = itemFamilyToPet(family)
 * // pet matches original Pet structure
 */
export function itemFamilyToPet(family: ItemFamily): Pet {
  const firstLevel = family.levelVariants[0]
  const firstObtain = firstLevel?.obtainVariants[0]
  
  if (!firstLevel) {
    throw new Error(`ItemFamily ${family.id} has no level variants`)
  }
  
  // Convert ObtainVariants back to ObtainMethods
  const obtainMethods = firstLevel.obtainVariants.map(variant => ({
    location: variant.location,
    price: variant.price,
    priceType: variant.priceType,
    requiredItems: variant.requiredItems,
    sellback: variant.sellback ?? '0 Gold',
  }))
  
  // Get element (level override or shared)
  const element = firstLevel.element ?? family.shared.element ?? ''
  
  // Build Pet object
  const pet: Pet = {
    // Identity
    id: family.id,
    name: firstLevel.name,
    slug: family.slug,
    type: family.type as 'pet' | 'guest',
    
    // Description
    description: firstLevel.description ?? family.shared.description,
    daRequired: firstObtain?.daRequired ?? false,
    dcRequired: firstObtain?.dcRequired,
    dmRequired: firstObtain?.dmRequired,
    
    // Categories (family flags map to Pet flags)
    isTemp: undefined, // Not stored in ItemFamily (yet)
    isRare: undefined,
    isSeasonal: undefined,
    isSpecialOffer: undefined,
    retired: undefined,
    
    // Elements
    elements: family.elements.length > 0 ? family.elements : [element],
    traits: [], // Not stored in ItemFamily
    
    // Stats
    level: firstLevel.levelDisplay,
    damage: firstLevel.damage,
    stats: firstLevel.stats,
    resists: firstLevel.resists ?? family.shared.resists ?? 'None',
    
    // Acquisition
    obtainMethods,
    
    // Combat
    attacks: family.type === 'guest'
      ? []
      : ((firstLevel.attacks ?? family.shared.attacks ?? []) as Pet['attacks']),
    rarity: firstLevel.rarity ?? family.shared.rarity ?? '1',
    
    // Evolution paths (not in ItemFamily yet)
    evolutions: [],
    
    // Metadata
    releaseDate: family.releaseDate ?? '',
    imageUrl: firstLevel.imageUrl ?? family.shared.imageUrl,
    ...(firstLevel.alternativeImages || family.shared.alternativeImages
      ? { alternativeImages: firstLevel.alternativeImages ?? family.shared.alternativeImages }
      : {}),
    forumUrl: family.forumUrl,
    notes: firstLevel.notes ?? family.shared.notes,
    alsoSee: (family.shared.alsoSee ?? []).map(ref => ({
      name: ref.name,
      slug: ref.slug,
      type: ref.type as 'pet' | 'guest', // Cast ItemType to EntryType
    })) as PetAlsoSeeRef[],
    
    // Search
    tags: family.tags,
  }

  if (family.type === 'guest' && firstLevel.guestStats) {
    return {
      ...(pet as unknown as Guest),
      type: 'guest',
      guestStats: firstLevel.guestStats,
      attacks: (firstLevel.attacks ?? family.shared.attacks ?? []) as Guest['attacks'],
    } as unknown as Pet
  }
  
  return pet
}
