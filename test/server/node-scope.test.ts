import { expect, test } from 'vitest'
import { hostsParcel, intersectParcels, nodeScope } from '../../common/node-scope.mjs'

test('coverage intersections preserve only shared parcels, including disjoint selections', () => {
  const partial = nodeScope('partial', [9, 2, 9])
  expect(partial.parcels).toEqual([2, 9])
  expect(hostsParcel(partial, 2)).toBe(true)
  expect(hostsParcel(partial, 3)).toBe(false)
  expect(hostsParcel(nodeScope(), NaN)).toBe(false)
  expect(intersectParcels(partial.parcels, null)).toEqual([2, 9])
  expect(intersectParcels(partial.parcels, [9, 4])).toEqual([9])
  expect(intersectParcels(partial.parcels, [4])).toEqual([])
})

test('invalid selections fail closed instead of becoming full coverage', () => {
  for (const ids of ['', [], '1,,2', '1e2', '1.2', '-1', '2147483648', new Array(10001).fill(1)]) expect(() => nodeScope('partial', ids)).toThrow()
  expect(() => nodeScope('full', '1')).toThrow()
})
