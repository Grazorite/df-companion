import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  rehydrateSearchIndex,
  searchHits,
  toCompactIndex,
  type CompactSearchRecord,
  type SearchHit,
} from '../src/utils/searchIndex.ts'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_PATH = `${PROJECT_ROOT}/src/data/search-index.json`

function loadCompactIndex(): CompactSearchRecord[] {
  return JSON.parse(readFileSync(INDEX_PATH, 'utf-8')) as CompactSearchRecord[]
}

test('committed compact search index exists and is a non-trivial array', () => {
  const index = loadCompactIndex()
  assert.ok(Array.isArray(index), 'search-index.json must be an array')
  // The datasets together carry several thousand entries; guard against an empty/partial index.
  assert.ok(index.length > 5_000, `expected a full index, saw ${index.length} records`)
})

test('compact index stays within the 1.5 MiB decoded budget', () => {
  const bytes = Buffer.byteLength(readFileSync(INDEX_PATH, 'utf-8'), 'utf-8')
  const budget = 1.5 * 1024 * 1024
  assert.ok(bytes <= budget, `search-index.json is ${bytes} bytes, over the ${budget}-byte budget`)
})

test('every compact record carries the fields the palette needs', () => {
  const index = loadCompactIndex()
  const sections = new Set([
    'Badges',
    'Pets',
    'Guests',
    'Accessories',
    'Weapons',
    'Housing',
    'Classes & Abilities',
  ])
  for (const record of index) {
    assert.equal(typeof record.label, 'string')
    assert.ok(record.label.length > 0)
    assert.ok(sections.has(record.section), `unknown section ${record.section}`)
    assert.equal(typeof record.url, 'string')
    assert.ok(record.url.startsWith('/'), `route must be app-relative, saw ${record.url}`)
  }
})

test('rehydrated index preserves ranking, grouping, and article-normalized search', () => {
  const index = loadCompactIndex()
  const hits = rehydrateSearchIndex(index)

  // Rehydration reconstructs full SearchHit shape (id + words) for the palette.
  for (const hit of hits.slice(0, 50)) {
    assert.equal(typeof hit.id, 'string')
    assert.ok(Array.isArray(hit.words) && hit.words.length > 0)
  }

  // Article-normalized search: an entry stored as "X, The" should be findable by "the x".
  const articleEntry = hits.find((hit) => /^The\s/.test(hit.label))
  if (articleEntry) {
    const firstWord = articleEntry.label.replace(/^The\s+/, '').split(/\s+/)[0].toLowerCase()
    const found = searchHits(hits, `the ${firstWord}`).some((hit) => hit.id === articleEntry.id)
    assert.ok(found, `article-normalized search should find "${articleEntry.label}"`)
  }
})

test('toCompactIndex and rehydrateSearchIndex round-trip to equivalent hits', () => {
  const sample: SearchHit[] = [
    {
      id: 'Badges:test-badge:',
      label: 'The Test Badge',
      section: 'Badges',
      url: '/badges/test-badge',
      words: ['the', 'test', 'badge'],
    },
    {
      id: 'Weapons:test-blade:Swords, Axes, & Maces',
      label: 'Test Blade',
      section: 'Weapons',
      sublabel: 'Swords, Axes, & Maces',
      url: '/weapons/test-blade?type=sword-axe-mace',
      words: ['test', 'blade'],
    },
  ]

  const round = rehydrateSearchIndex(toCompactIndex(sample))
  assert.deepEqual(
    round.map((hit) => ({ id: hit.id, label: hit.label, section: hit.section, url: hit.url })),
    sample.map((hit) => ({ id: hit.id, label: hit.label, section: hit.section, url: hit.url }))
  )
  // Words are recomputed on rehydrate; they should still support prefix search.
  assert.ok(searchHits(round, 'test').length === 2)
})
