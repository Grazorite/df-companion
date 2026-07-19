import { createDefaultAccessoryStrategy, type AccessorySubtypeStrategy } from './types.ts'

export const helmStrategy: AccessorySubtypeStrategy = {
  ...createDefaultAccessoryStrategy('helm'),
  shouldExtractImages: () => true,
}
