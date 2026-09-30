// @vitest-environment node
import { test, expect } from 'vitest'
import { Wallet, id } from 'ethers'
import { randomUUID } from 'node:crypto'
import { editId, editMessage, verifyEdit, type WorldEdit } from '../../common/federation/edit'
import { rightsId, resolvePermissions, parcelRole, signerOf, type ParcelRights } from '../../common/federation/permissions'
const owner = Wallet.createRandom(),
  manager = Wallet.createRandom(),
  builder = Wallet.createRandom(),
  outsider = Wallet.createRandom(),
  admin = Wallet.createRandom()
const rights: ParcelRights = {
  owner: owner.address.toLowerCase(),
  users: [
    { owner: manager.address.toLowerCase(), role: 'owner' },
    { owner: builder.address.toLowerCase(), role: 'contributor' },
  ],
}
async function change(signer: any, authority: string, patch: Record<string, any>, clock = 1): Promise<WorldEdit> {
  const event: WorldEdit = { version: 2, world: id('rights-world'), parcel: 1, base: id('{}'), authority, clock, parent: null, nonce: randomUUID().replaceAll('-', ''), patches: [patch], signature: '' }
  event.signature = await signer.signMessage(editMessage(event))
  verifyEdit(event, event.world, signer.address)
  return event
}
const resolve = (events: WorldEdit[]) => resolvePermissions(rights, events, admin.address)
test('snapshot owners, managers and builders retain distinct permissions; strangers and renters gain none', async () => {
  expect(parcelRole(rights, owner.address, admin.address)).toBe('owner')
  expect(parcelRole(rights, manager.address, admin.address)).toBe('owner')
  expect(parcelRole(rights, builder.address, admin.address)).toBe('contributor')
  expect(parcelRole(rights, outsider.address, admin.address)).toBe(false)
  const build = await change(builder, rightsId(rights), { brightness: 0.5 })
  expect(resolve([build]).applied).toHaveLength(1)
  const bad = await change(outsider, rightsId(rights), { brightness: 0.5 })
  expect(() => resolve([bad])).toThrow('no build rights')
  const grant = await change(builder, rightsId(rights), { permissions: { root: rightsId(rights), epoch: 0, users: rights.users, retained: [] } })
  expect(() => resolve([grant])).toThrow('Only owners and managers')
})
test('revocation preserves acknowledged builds but holds unseen stale-permission edits independent of arrival order', async () => {
  const before = await change(builder, rightsId(rights), { brightness: 0.5 })
  const unseen = await change(builder, rightsId(rights), { brightness: 0.9 })
  const revoke = await change(manager, rightsId(rights), { permissions: { root: rightsId(rights), epoch: 0, users: [rights.users[0]], retained: [editId(before)] } }, 2)
  for (const events of [
    [before, unseen, revoke],
    [revoke, unseen, before],
  ]) {
    const state = resolve(events)
    expect(state.applied.map(editId)).toEqual([editId(before)])
    expect(state.pending.map(editId)).toEqual([editId(unseen)])
    expect(parcelRole(state.active, builder.address, admin.address)).toBe(false)
  }
  const forged = await change(builder, editId(revoke), { brightness: 0.7 }, 3)
  expect(() => resolve([before, revoke, forged])).toThrow('no build rights')
})
test('conflicting manager updates pause writes; only the root owner can settle the epoch and approve held changes', async () => {
  const oldBuild = await change(builder, rightsId(rights), { brightness: 0.5 })
  const a = await change(manager, rightsId(rights), { permissions: { root: rightsId(rights), epoch: 0, users: [rights.users[0]], retained: [] } }, 2)
  const b = await change(manager, rightsId(rights), { permissions: { root: rightsId(rights), epoch: 0, users: rights.users, retained: [] } }, 2)
  expect(resolve([oldBuild, a, b]).active.locked).toBe(true)
  const settled = await change(owner, rightsId(rights), { permissions: { root: rightsId(rights), epoch: 1, users: [], retained: [editId(oldBuild)] } }, 3)
  const result = resolve([b, settled, oldBuild, a])
  expect(result.active.locked).toBe(false)
  expect(result.active.epoch).toBe(1)
  expect(result.applied.map(editId)).toEqual([editId(oldBuild)])
  const laterOldManager = await change(manager, editId(a), { permissions: { root: rightsId(rights), epoch: 0, users: rights.users, retained: [] } }, 4)
  expect(resolve([oldBuild, a, b, settled, laterOldManager]).active.id).toBe(editId(settled))
  const fakeEpoch = await change(manager, editId(a), { permissions: { root: rightsId(rights), epoch: 1, users: rights.users, retained: [] } }, 4)
  expect(() => resolve([a, fakeEpoch])).toThrow('epoch')
})
test('permission proofs are bound to edits and signature cache does not accept mutated payloads', async () => {
  const event = await change(builder, rightsId(rights), { brightness: 0.5 })
  expect(signerOf(event)).toBe(builder.address.toLowerCase())
  const tampered = { ...event, patches: [{ brightness: 0.7 }] }
  expect(() => verifyEdit(tampered, event.world, builder.address)).toThrow()
})
