import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { idbDelete, idbGet, idbSet, idbUpdate } from './idb'

it('stores, overwrites and deletes values in order', async () => {
  expect(await idbGet('k')).toBeUndefined()
  await Promise.all([idbSet('k', 'one'), idbSet('k', { two: 2 })])
  expect(await idbGet('k')).toEqual({ two: 2 })
  await idbDelete('k')
  expect(await idbGet('k')).toBeUndefined()
})

it('updates atomically, so concurrent read-modify-writes all land', async () => {
  await Promise.all([1, 2, 3].map((n) => idbUpdate<number[]>('list', (cur = []) => [...cur, n])))
  expect(await idbGet('list')).toEqual([1, 2, 3])
})
