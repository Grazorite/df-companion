import assert from 'node:assert/strict'
import test from 'node:test'
import { searchBadges } from '../src/utils/search.ts'
import type { Badge } from '../src/types/badge.ts'

const badges: Badge[] = [
  {
    id: 'badge-locksmith',
    name: 'Locksmith',
    slug: 'locksmith',
    description: 'A badge for careful key work.',
    category: 'quest-completion',
    subcategory: 'Early Days',
    howToObtain: [{ order: 1, instruction: 'Open the correct door.' }],
    requirements: 'Completion of the lock quest',
    daRequired: false,
    retired: false,
    forumLinks: [{ url: 'https://example.test/locksmith', title: 'Locksmith', isPrimary: true }],
    tags: ['keys'],
  },
  {
    id: 'badge-clock-tower',
    name: 'Clock Tower',
    slug: 'clock-tower',
    description: 'Timekeeping badge for an unlocked tower.',
    category: 'misc',
    subcategory: 'Misc',
    howToObtain: [{ order: 1, instruction: 'Visit the tower.' }],
    requirements: 'None',
    daRequired: true,
    retired: false,
    forumLinks: [{ url: 'https://example.test/clock', title: 'Clock Tower', isPrimary: true }],
    tags: [],
  },
  {
    id: 'badge-old-arena',
    name: 'Old Arena',
    slug: 'old-arena',
    description: 'Retired arena badge.',
    category: 'combat',
    subcategory: 'Arena Challenges',
    howToObtain: [{ order: 1, instruction: 'No longer obtainable.' }],
    requirements: 'Retired',
    daRequired: false,
    retired: true,
    forumLinks: [{ url: 'https://example.test/arena', title: 'Old Arena', isPrimary: true }],
    tags: ['arena'],
  },
]

test('searchBadges hides retired badges unless the retired filter is active', () => {
  assert.deepEqual(searchBadges(badges, {}).map((badge) => badge.slug), [
    'clock-tower',
    'locksmith',
  ])

  assert.deepEqual(searchBadges(badges, { retired: true }).map((badge) => badge.slug), [
    'old-arena',
  ])
})

test('searchBadges combines public filters with word-prefix search', () => {
  assert.deepEqual(searchBadges(badges, { query: 'lock' }).map((badge) => badge.slug), [
    'locksmith',
  ])

  assert.deepEqual(
    searchBadges(badges, { category: 'misc', daRequired: true }).map((badge) => badge.slug),
    ['clock-tower']
  )
})
