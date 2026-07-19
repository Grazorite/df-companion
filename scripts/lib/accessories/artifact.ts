import { createDefaultAccessoryStrategy, type AccessorySubtypeStrategy } from './types.ts'

function isWearableArtifactImageContext(value?: string): boolean {
  return /\b(?:head|helm|hat|back|cape|cloak|wing|wings)\b/i.test(value ?? '')
}

export const artifactStrategy: AccessorySubtypeStrategy = {
  ...createDefaultAccessoryStrategy('artifact'),
  shouldExtractImages: context =>
    isWearableArtifactImageContext(context.equipSpot) ||
    isWearableArtifactImageContext(context.itemType) ||
    isWearableArtifactImageContext(context.name),
  shouldEnrichAbility: entry => Boolean(entry.abilityUrl),
}
