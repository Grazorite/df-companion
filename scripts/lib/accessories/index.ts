import type { AccessorySubtype } from '../../../src/types/accessory.ts'
import type { AccessorySubtypeStrategy } from './types.ts'
import { artifactStrategy } from './artifact.ts'
import { beltStrategy } from './belt.ts'
import { bracerStrategy } from './bracer.ts'
import { capeWingStrategy } from './cape-wing.ts'
import { helmStrategy } from './helm.ts'
import { necklaceStrategy } from './necklace.ts'
import { ringStrategy } from './ring.ts'
import { trinketStrategy } from './trinket.ts'

export type { AccessorySubtypeStrategy } from './types.ts'

const strategies = new Map<AccessorySubtype, AccessorySubtypeStrategy>(
  [
    artifactStrategy,
    beltStrategy,
    bracerStrategy,
    capeWingStrategy,
    helmStrategy,
    necklaceStrategy,
    ringStrategy,
    trinketStrategy,
  ].map(strategy => [strategy.subtype, strategy])
)

export function getAccessorySubtypeStrategy(
  subtype: AccessorySubtype
): AccessorySubtypeStrategy {
  const strategy = strategies.get(subtype)
  if (!strategy) {
    throw new Error(`No accessory strategy registered for subtype: ${subtype}`)
  }
  return strategy
}
