import { test } from 'node:test'
import assert from 'node:assert/strict'
import { archivedParcelRights } from './parcel-rights.mjs'
const owner = '0x134561f705A9C2DDA470b2246D075Bf7A3c612d2',
  manager = '0x' + '1'.repeat(40),
  builder = '0x' + '2'.repeat(40)
test('archive migration preserves manager, builder and unrecognized historical roles without promoting them', () => {
  const result = archivedParcelRights({
    id: 7,
    owner: { owner },
    parcel_users: [
      { owner: manager, role: 'owner' },
      { owner: builder, role: 'contributor' },
      { owner: '0x' + '3'.repeat(40), role: 'renter' },
    ],
  })
  assert.equal(result.owner, owner.toLowerCase())
  assert.deepEqual(result.users, [
    { owner: manager, role: 'owner' },
    { owner: builder, role: 'contributor' },
    { owner: '0x' + '3'.repeat(40), role: 'renter' },
  ])
})
test('invalid or conflicting role records fail rather than silently broadening permissions', () => {
  for (const parcel_users of [
    [
      { owner: manager, role: 'owner' },
      { owner: manager, role: 'contributor' },
    ],
    [{ owner: manager, role: 'administrator\n' }],
  ])
    assert.throws(() => archivedParcelRights({ id: 7, owner, parcel_users }))
})

test('malformed historical wallet records remain archived without being repaired into grants', () => {
  const result = archivedParcelRights({ id: 7, owner, parcel_users: [{ owner: builder + ' ', role: 'contributor' }] })
  assert.deepEqual(result.users, [])
  assert.deepEqual(result.unresolved, [{ owner: builder + ' ', role: 'contributor' }])
})
