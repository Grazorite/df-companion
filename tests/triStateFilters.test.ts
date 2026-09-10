import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cycleSingleTriState,
  cycleTriState,
  getTriState,
  parseFilterParam,
} from '../src/utils/triStateFilters.ts'

type FilterId = 'rare' | 'retired' | 'seasonal'

const isFilterId = (value: string): value is FilterId =>
  value === 'rare' || value === 'retired' || value === 'seasonal'

test('cycleTriState walks a filter through neutral, include, exclude, and back', () => {
  let filters = { include: [] as FilterId[], exclude: [] as FilterId[] }

  assert.equal(getTriState('rare', filters), 'neutral')

  filters = cycleTriState('rare', filters)
  assert.deepEqual(filters, { include: ['rare'], exclude: [] })

  filters = cycleTriState('rare', filters)
  assert.deepEqual(filters, { include: [], exclude: ['rare'] })

  filters = cycleTriState('rare', filters)
  assert.deepEqual(filters, { include: [], exclude: [] })
})

test('cycleSingleTriState keeps only one active include or exclude value', () => {
  const filters = cycleSingleTriState('retired', {
    include: ['rare'],
    exclude: ['seasonal'],
  })

  assert.deepEqual(filters, { include: ['retired'], exclude: [] })
})

test('parseFilterParam drops unknown URL values at the public boundary', () => {
  assert.deepEqual(parseFilterParam('rare,unknown,seasonal', isFilterId), ['rare', 'seasonal'])
  assert.deepEqual(parseFilterParam(null, isFilterId), [])
})
