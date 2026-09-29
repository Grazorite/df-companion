import assert from 'node:assert/strict'
import test from 'node:test'
import {
  backUrlFromSearch,
  detailUrlWithFrom,
  isBrowseListPath,
  isDetailRoutePath,
} from '../src/utils/navigationContext.ts'

test('related detail links retain the original browse URL', () => {
  const browseUrl = '/pets?type=pet&element=%5BNAT%5D'
  const firstDetail = detailUrlWithFrom('/pets/pet-dragon', browseUrl)
  const relatedDetail = detailUrlWithFrom(
    '/pets/pet-togslayer',
    backUrlFromSearch(new URL(firstDetail, 'https://example.test').search, '/pets')
  )

  assert.equal(
    backUrlFromSearch(new URL(relatedDetail, 'https://example.test').search, '/pets'),
    browseUrl
  )
})

test('route shapes distinguish browse lists from entry details', () => {
  assert.equal(isBrowseListPath('/pets'), true)
  assert.equal(isBrowseListPath('/pets/pet-dragon'), false)
  assert.equal(isDetailRoutePath('/pets/pet-dragon'), true)
  assert.equal(isDetailRoutePath('/guests/guest-artix'), true)
  assert.equal(isDetailRoutePath('/helms'), false)
  assert.equal(isDetailRoutePath('/locations'), false)
})
