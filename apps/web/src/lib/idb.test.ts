import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { idbDelete, idbGet, idbSet } from './idb'

it('stores, overwrites and deletes values in order', async () => {
  expect(await idbGet('k')).toBeUndefined()
  await Promise.all([idbSet('k', 'one'), idbSet('k', { two: 2 })])
  expect(await idbGet('k')).toEqual({ two: 2 })
  await idbDelete('k')
  expect(await idbGet('k')).toBeUndefined()
})
