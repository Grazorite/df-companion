import assert from 'node:assert/strict'
import test from 'node:test'
import { compareTitles, displayTitle, normalizeDescriptionText } from '../src/utils/displayText.ts'

test('displayTitle restores trailing articles without changing stable source text', () => {
  assert.equal(displayTitle('Golden Egg, The'), 'The Golden Egg')
  assert.equal(displayTitle('ChronoZ'), 'ChronoZ')
})

test('compareTitles sorts leading articles by the meaningful title word', () => {
  const titles = ['Zardbie', 'Golden Egg, The', 'Aegis']

  assert.deepEqual(titles.toSorted(compareTitles), ['Aegis', 'Golden Egg, The', 'Zardbie'])
})

test('normalizeDescriptionText strips access markers from display prose', () => {
  assert.equal(
    normalizeDescriptionText('A bright badge. (DA required)'),
    'A bright badge.'
  )
  assert.equal(
    normalizeDescriptionText('Available with D-Amulet/D-Coins (DC item).'),
    'Available with DA/DC.'
  )
})
