// @vitest-environment node
import { expect, test } from 'vitest'
import { Wallet, id } from 'ethers'
import { generateKeyPairSync } from 'node:crypto'
import { canonical, editMessage, verifyEdit, type WorldEdit } from '../../common/federation/edit'
import { materialize } from '../../server/federation/materialize'
import { getBufferFromVoxels } from '../../common/voxels/helpers'
import { signPresence, validPresence, remotePlayerId } from '../../services/federation-presence'
const wallet = Wallet.createRandom(),
  world = id('test-world')
async function edit(patches: Record<string, any>[], clock = 1): Promise<WorldEdit> {
  const event: WorldEdit = { version: 1, world, parcel: 1, base: id('{}'), clock, parent: null, nonce: 'a'.repeat(32), patches, signature: '' }
  event.signature = await wallet.signMessage(editMessage(event))
  return event
}
test('a node can independently verify editor permission and reject tampering or another world', async () => {
  const event = await edit([{ brightness: 0.4 }])
  expect(verifyEdit(event, world, wallet.address)).toMatch(/^0x[0-9a-f]{64}$/)
  expect(() => verifyEdit({ ...event, patches: [{ brightness: 8 }] }, world, wallet.address)).toThrow()
  expect(() => verifyEdit(event, id('different'), wallet.address)).toThrow()
  expect(() => verifyEdit(event, world, Wallet.createRandom().address)).toThrow()
})
test('concurrent disjoint voxel edits survive reordering and conflicting edits converge', async () => {
  const a = await edit([{ voxels: { positions: [[0, 0, 0]], value: 3 } }])
  const b = await edit([{ voxels: { positions: [[1, 0, 0]], value: 4 } }])
  const c = await edit([{ voxels: { positions: [[0, 0, 0]], value: 7 } }])
  const first = materialize({}, [a, b, c], [2, 2, 2]),
    second = materialize({}, [c, b, a], [2, 2, 2])
  expect(canonical(first)).toBe(canonical(second))
  const field = getBufferFromVoxels({ voxels: first.voxels, fieldShape: [2, 2, 2] })!
  expect(field.get(1, 0, 0)).toBe(4)
  expect([3, 7]).toContain(field.get(0, 0, 0))
})
test('feature updates merge across hosts and ordered deletion survives replay', async () => {
  const a = await edit([{ features: { cube: { uuid: 'cube', type: 'cube', position: [1, 2, 3] } } }])
  const b = await edit([{ features: { cube: { color: '#008fff' } } }], 2)
  const c = await edit([{ features: { cube: null } }], 3)
  expect(materialize({}, [b, a], [2, 2, 2]).features[0]).toMatchObject({ position: [1, 2, 3], color: '#008fff' })
  expect(materialize({}, [c, b, a], [2, 2, 2]).features).toEqual([])
})
test('unsafe feature keys and out-of-bounds voxel edits are rejected', async () => {
  const unsafe = await edit([JSON.parse('{"features":{"__proto__":{"polluted":true}}}')])
  expect(() => verifyEdit(unsafe, world, wallet.address)).toThrow('Unsafe')
  const outside = await edit([{ voxels: { positions: [[9, 0, 0]], value: 4 } }])
  expect(() => materialize({}, [outside], [2, 2, 2])).toThrow('outside')
})
test('presence signatures expire, resist tampering, and keep host player IDs separate', () => {
  const keys = generateKeyPairSync('ed25519'),
    secret = keys.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  const player = { uuid: '12345678-1234-4234-8234-123456789abc', position: [1, 2, 3], orientation: [0, 0, 0, 1] as [number, number, number, number], animation: 0 }
  const packet = signPresence(world, secret, [player], 100000)
  expect(validPresence(packet, world, 100001)).toBe(true)
  expect(validPresence({ ...packet, ip: '127.0.0.1' } as any, world, 100001)).toBe(false)
  const privatePlayer = { ...player, ip: '127.0.0.1' }
  expect(signPresence(world, secret, [privatePlayer], 100000).payload.players).toEqual([])
  expect(validPresence(packet, world, 116000)).toBe(false)
  expect(validPresence({ ...packet, payload: { ...packet.payload, players: [{ ...player, position: [4, 5, 6] }] } }, world, 100001)).toBe(false)
  expect(remotePlayerId('host-a', player.uuid)).not.toBe(remotePlayerId('host-b', player.uuid))
})
