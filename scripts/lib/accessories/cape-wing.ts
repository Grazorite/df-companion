import { createDefaultAccessoryStrategy, type AccessorySubtypeStrategy } from './types.ts'

export const capeWingStrategy: AccessorySubtypeStrategy = {
  ...createDefaultAccessoryStrategy('cape-wing'),
  shouldExtractImages: () => true,
}
