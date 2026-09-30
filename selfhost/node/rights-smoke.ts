// Disposable local nodes only. Never use a real wallet key with this harness.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { Wallet } from 'ethers'
import { editId, editMessage, type WorldEdit } from '../../common/federation/edit'
async function main() {
  const [a, b, keyFile, directory] = process.argv.slice(2)
  if (![a, b].every((x) => /^http:\/\/localhost:\d+$/.test(x)) || directory !== '/tmp/voxels-rights-a') throw Error('Use only disposable localhost rights nodes')
  const keys = JSON.parse(await readFile(keyFile, 'utf8')),
    wallets = Object.fromEntries(Object.entries(keys).map(([role, value]: [string, any]) => [role, new Wallet(value.privateKey)]))
  const info = await fetch(a + '/federation/info').then((r) => r.json())
  assert.equal(info.version, 2)
  assert.equal(info.editor.toLowerCase(), wallets.admin.address.toLowerCase())
  const head = (base: string) => fetch(base + '/federation/parcel/1', { headers: { Connection: 'close' } }).then((r) => r.json())
  async function event(base: string, role: string, patch: Record<string, any>, state?: any) {
    const h = state || (await head(base))
    const result: WorldEdit = { version: 2, world: info.world, parcel: 1, base: h.base, authority: h.permission.id, parent: h.parent, clock: h.clock + 1, nonce: randomUUID().replaceAll('-', ''), patches: [patch], signature: '' }
    result.signature = await wallets[role].signMessage(editMessage(result))
    return result
  }
  async function post(base: string, e: WorldEdit, status = 200, batch = false) {
    const r = await fetch(base + (batch ? '/federation/batch' : '/federation/edits'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch ? { events: [e] } : e) })
    assert.equal(r.status, status, await r.text())
  }
  async function wait(fn: () => Promise<boolean>, label: string) {
    for (let i = 0; i < 60; i++) {
      if (await fn()) return
      await new Promise((r) => setTimeout(r, 500))
    }
    throw Error('Timeout: ' + label)
  }
  async function policy(base: string, role: string, users: any[], approved: string[] = [], state?: any) {
    const h = state || (await head(base)),
      root = [h.permission.owner, info.editor.toLowerCase()].includes(wallets[role].address.toLowerCase())
    return event(base, role, { permissions: { root: h.permission.root, epoch: h.permission.epoch + (root ? 1 : 0), users, retained: [...new Set([...h.applied, ...approved])] } }, h)
  }
  const builder = wallets.builder.address.toLowerCase(),
    manager = wallets.manager.address.toLowerCase(),
    outsider = wallets.outsider.address.toLowerCase()
  let h = await head(a)
  assert.equal(h.permission.owner, wallets.owner.address.toLowerCase())
  assert.ok(h.permission.users.some((u: any) => u.owner === manager && u.role === 'owner'))
  assert.ok(h.permission.users.some((u: any) => u.owner === builder && u.role === 'contributor'))
  if (h.permission.users.some((u: any) => u.owner === outsider)) {
    const reset = await policy(
      a,
      'owner',
      h.permission.users.filter((u: any) => u.owner !== outsider),
    )
    await post(a, reset)
    await wait(async () => (await head(b)).permission.id === editId(reset), 'test fixture permissions restored')
  }
  // Cross the single-digit boundary: the advertised revision must sort numerically.
  for (let i = 0; i < 12; i++) {
    const before = await head(b)
    await post(b, await event(b, 'builder', { brightness: 0.5 }, before))
    assert.equal((await head(b)).clock, before.clock + 1)
  }
  const first = await event(b, 'builder', { features: { ['build-' + randomUUID()]: { type: 'cube', position: [1, 2, 3] } } })
  await post(b, first)
  await wait(async () => (await head(a)).applied.includes(editId(first)), 'delegated build propagation')
  await post(b, await event(b, 'outsider', { brightness: 1 }), 400)
  await post(b, await policy(b, 'builder', h.permission.users), 400)
  console.log('PASS archived managers/builders restored; delegated build synchronizes; strangers and builder grants rejected')
  h = await head(a)
  const grant = await policy(a, 'manager', [...h.permission.users, { owner: outsider, role: 'contributor' }])
  await post(a, grant)
  await wait(async () => (await head(b)).permission.id === editId(grant), 'manager grant')
  const outsiderBuild = await event(b, 'outsider', { brightness: 0.8 })
  await post(b, outsiderBuild)
  await wait(async () => (await head(a)).applied.includes(editId(outsiderBuild)), 'new builder edit')
  const stale = await event(b, 'builder', { features: { ['held-' + randomUUID()]: { type: 'cube', position: [7, 2, 3] } } })
  h = await head(a)
  const revoked = await policy(
    a,
    'manager',
    h.permission.users.filter((u: any) => u.owner !== builder),
  )
  await post(a, revoked)
  await wait(async () => (await head(b)).permission.id === editId(revoked), 'revocation')
  await post(b, stale, 400)
  await post(b, await event(b, 'builder', { brightness: 0.2 }), 400)
  await post(b, stale, 200, true)
  await wait(async () => (await head(a)).pending.some((p: any) => p.id === editId(stale)), 'stale signed edit retained for review')
  assert.ok(!(await head(a)).applied.includes(editId(stale)))
  console.log('PASS manager revocation propagates; stale and revoked writes cannot silently regain authority')
  h = await head(a)
  const approval = await policy(a, 'owner', h.permission.users, [editId(stale)])
  await post(a, approval)
  await wait(async () => (await head(b)).applied.includes(editId(stale)), 'owner approval')
  await post(b, await event(b, 'builder', { brightness: 0.2 }), 400)
  console.log('PASS parcel owner can preserve a held change without restoring revoked builder rights')
  const env = await readFile(directory + '/app.env', 'utf8')
  async function recreate() {
    const result = spawnSync('docker', ['compose', '--file', directory + '/compose.json', 'up', '--detach', '--no-deps', '--force-recreate', '--wait', 'world', 'gateway'], { stdio: 'pipe' })
    if (result.status) throw Error('Test node restart failed')
    await wait(async () => {
      try {
        return (await fetch(a + '/federation/info', { headers: { Connection: 'close' } })).ok
      } catch {
        return false
      }
    }, 'test host ready')
  }
  try {
    await writeFile(directory + '/app.env', env.replace(/^FEDERATION_PEERS=.*$/m, 'FEDERATION_PEERS='))
    await recreate()
    const ha = await head(a),
      hb = await head(b)
    assert.equal(ha.permission.id, hb.permission.id)
    const left = await policy(a, 'manager', [...ha.permission.users, { owner: builder, role: 'contributor' }], [], ha)
    const right = await policy(
      b,
      'manager',
      hb.permission.users.filter((u: any) => u.owner !== outsider),
      [],
      hb,
    )
    await post(a, left)
    await post(b, right)
    await writeFile(directory + '/app.env', env)
    await recreate()
    await wait(async () => (await head(a)).permission.locked && (await head(b)).permission.locked, 'conflicting rights pause both hosts')
    await post(a, await event(a, 'manager', { brightness: 0.1 }), 400)
    h = await head(a)
    const settled = await policy(a, 'owner', [
      { owner: manager, role: 'owner' },
      { owner: builder, role: 'contributor' },
    ])
    await post(a, settled)
    await wait(async () => (await head(b)).permission.id === editId(settled) && !(await head(b)).permission.locked, 'owner conflict resolution')
    const final = await event(b, 'builder', { metadata: { name: 'Rights verified' } })
    await post(b, final)
    await wait(async () => (await head(a)).applied.includes(editId(final)), 'post-resolution delegated edit')
    console.log('PASS conflicting manager updates pause writes; owner resolution restores agreed permissions on both hosts')
  } finally {
    await writeFile(directory + '/app.env', env)
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
