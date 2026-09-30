// Explicit disposable full/partial test nodes and throwaway fixture wallets only.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Wallet } from 'ethers'
import { editId, editMessage, type WorldEdit } from '../../common/federation/edit'
async function main() {
  const [a, b, keyFile] = process.argv.slice(2)
  if (a !== 'http://localhost:28381' || b !== 'http://localhost:28382' || keyFile !== '/tmp/voxels-rights-wallets.json') throw Error('Use the disposable coverage fixtures only')
  const keys = JSON.parse(await readFile(keyFile, 'utf8'))
  const wallets = Object.fromEntries(Object.entries(keys).map(([name, value]: [string, any]) => [name, new Wallet(value.privateKey)]))
  const info = await fetch(a + '/federation/info').then((r) => r.json())
  const partial = await fetch(b + '/federation/info').then((r) => r.json())
  assert.deepEqual(info.coverage, { mode: 'full', parcels: null })
  assert.deepEqual(partial.coverage, { mode: 'partial', parcels: [1] })
  const head = (base: string, parcel = 1) => fetch(`${base}/federation/parcel/${parcel}`).then((r) => r.json())
  async function event(base: string, role: string, parcel: number, patches: any[]) {
    const h = await head(base, parcel)
    const e: WorldEdit = { version: 2, world: info.world, parcel, base: h.base, authority: h.permission.id, parent: h.parent, clock: h.clock + 1, nonce: randomUUID().replaceAll('-', ''), patches, signature: '' }
    e.signature = await wallets[role].signMessage(editMessage(e))
    return e
  }
  async function post(base: string, edit: WorldEdit, status = 200) {
    const r = await fetch(base + '/federation/edits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) })
    assert.equal(r.status, status, await r.text())
  }
  async function wait(check: () => Promise<boolean>, label: string) {
    for (let i = 0; i < 60; i++) {
      if (await check()) return
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw Error('Timeout: ' + label)
  }
  assert.equal((await fetch(b + '/federation/parcel/2')).status, 400)
  const excluded = await event(a, 'owner', 2, [{ brightness: 0.8 }])
  await post(a, excluded)
  await post(b, excluded, 400)
  assert.equal((await fetch(b + '/federation/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [excluded] }) })).status, 400)
  const h = await head(b)
  assert.equal(h.permission.owner, wallets.owner.address.toLowerCase())
  assert.ok(h.permission.users.some((u: any) => u.owner === wallets.manager.address.toLowerCase() && u.role === 'owner'))
  const delegated = await event(b, 'builder', 1, [{ brightness: 0.7 }])
  await post(b, delegated)
  await wait(async () => (await head(a)).applied.includes(editId(delegated)), 'partial to full delegated edit')
  await post(b, await event(b, 'outsider', 1, [{ brightness: 0.2 }]), 400)
  const selected = await event(a, 'owner', 1, [{ metadata: { name: 'Selected parcel verified' } }])
  await post(a, selected)
  await wait(async () => (await head(b)).applied.includes(editId(selected)), 'full to partial after excluded event')
  const feed = await fetch(a + '/federation/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parcels: [1] }) }).then((r) => r.json())
  assert.ok(feed.events.length > 0 && feed.events.every((r: any) => r.event.parcel === 1))
  const state = await head(a)
  const revoked = await event(a, 'owner', 1, [
    { permissions: { root: state.permission.root, epoch: state.permission.epoch + 1, users: state.permission.users.filter((u: any) => u.owner !== wallets.builder.address.toLowerCase()), retained: state.applied } },
  ])
  await post(a, revoked)
  await wait(async () => (await head(b)).permission.id === editId(revoked), 'rights revocation')
  await post(b, await event(b, 'builder', 1, [{ brightness: 0.1 }]), 400)
  assert.equal((await fetch(b + '/federation/edit/' + editId(excluded))).status, 404)
  console.log('PASS full/partial selection, bidirectional delegated edits, excluded parcel rejection, filtered feed and synchronized revocation')
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
