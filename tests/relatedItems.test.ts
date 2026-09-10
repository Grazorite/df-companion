import assert from 'node:assert/strict'
import test from 'node:test'
import {
  obtainMethodFingerprint,
  obtainMethodInferenceFingerprint,
  relatedNameScore,
} from '../src/utils/relatedItems.ts'
import type { ObtainVariant } from '../src/types/item.ts'

const rarePetShopMethod = (price: string, daRequired: boolean): ObtainVariant => ({
  location: 'Rare Pets',
  price,
  priceType: 'dc',
  sellback: '0 DC',
  daRequired,
  dcRequired: true,
})

test('inferred obtain fingerprints ignore exact price and access flags for sibling matching', () => {
  const cheap = rarePetShopMethod('100 Dragon Coins', false)
  const expensive = rarePetShopMethod('300 Dragon Coins', true)

  assert.notEqual(obtainMethodFingerprint(cheap), obtainMethodFingerprint(expensive))
  assert.equal(obtainMethodInferenceFingerprint(cheap), obtainMethodInferenceFingerprint(expensive))
})

test('relatedNameScore favors specific shared names and filters generic item words', () => {
  assert.ok(relatedNameScore('First Golden Ring', 'Fifth Golden Ring') >= 0.55)
  assert.ok(relatedNameScore('Golden Ring', 'Shadow Cape') < 0.55)
})
