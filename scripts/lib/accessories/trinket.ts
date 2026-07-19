import { createDefaultAccessoryStrategy, type AccessorySubtypeStrategy } from './types.ts'

export const trinketStrategy: AccessorySubtypeStrategy = {
  ...createDefaultAccessoryStrategy('trinket'),
  shouldEnrichAbility: entry => Boolean(entry.abilityUrl),
}
