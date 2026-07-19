import type { Accessory, AccessorySubtype } from '../../../src/types/accessory.ts'

export interface AccessoryImageContext {
  name: string
  subtype: AccessorySubtype
  itemType?: string
  equipSpot?: string
}

export interface AccessorySubtypeStrategy {
  subtype: AccessorySubtype
  shouldExtractImages(context: AccessoryImageContext): boolean
  shouldEnrichAbility(entry: Accessory): boolean
}

export function createDefaultAccessoryStrategy(
  subtype: AccessorySubtype
): AccessorySubtypeStrategy {
  return {
    subtype,
    shouldExtractImages: () => false,
    shouldEnrichAbility: () => false,
  }
}
