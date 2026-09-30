// Explicit local integration harness. Uses only its throwaway editor key and test nodes.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { Wallet, id } from 'ethers'
import WebSocket from 'ws'
import * as messages from '../../common/messages'
import { editMessage, editId, type WorldEdit } from '../../common/federation/edit'
import { remotePlayerId } from '../../services/federation-presence'

async function main() {
  const [a, b, keyFile, partitionDirectory] = process.argv.slice(2)
  if (!a || !b || !keyFile || ![a, b].every((x) => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(x))) throw Error('Usage: sync-smoke.ts LOCAL_NODE_A LOCAL_NODE_B THROWAWAY_KEY_FILE')
  const wallet = new Wallet(JSON.parse(await readFile(keyFile, 'utf8')).privateKey)
  const info = await fetch(a + '/federation/info').then((r) => r.json())
  const second = await fetch(b + '/federation/info').then((r) => r.json())
  assert.equal(info.world, second.world)
  assert.equal(info.editor.toLowerCase(), wallet.address.toLowerCase())
  async function submit(base: string, patch: Record<string, any>) {
    const head = await fetch(base + '/federation/parcel/1', { headers: { Connection: 'close' } }).then((r) => r.json())
    const event: WorldEdit = { version: 1, world: info.world, parcel: 1, base: head.base, parent: head.parent, clock: head.clock + 1, nonce: randomUUID().replaceAll('-', ''), patches: [patch], signature: '' }
    event.signature = await wallet.signMessage(editMessage(event))
    const response = await fetch(base + '/federation/edits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) })
    assert.equal(response.status, 200, await response.text())
    return event
  }
  async function waitFor(fn: () => Promise<boolean>, label: string) {
    const end = Date.now() + 30000
    while (Date.now() < end) {
      if (await fn()) return
      await new Promise((r) => setTimeout(r, 500))
    }
    throw Error('Timed out: ' + label)
  }
  async function has(base: string, event: WorldEdit) {
    let after = 0
    for (let page = 0; page < 100; page++) {
      const feed = await fetch(base + '/federation/events?after=' + after).then((r) => r.json())
      if (feed.events.some((row: any) => editId(row.event) === editId(event))) return true
      if (feed.next === after) return false
      after = feed.next
    }
    throw Error('Test feed exceeded its bounded history budget')
  }
  let originalEnv: string | undefined
  async function recreate() {
    const result = spawnSync('docker', ['compose', '--file', partitionDirectory + '/compose.json', 'up', '--detach', '--no-deps', '--force-recreate', '--wait', 'world', 'gateway'], { stdio: 'pipe' })
    if (result.status !== 0) throw Error('Test node recreation failed: ' + result.stderr.toString())
    await waitFor(async () => {
      try {
        return (await fetch(a + '/federation/info', { headers: { Connection: 'close' } })).ok
      } catch {
        return false
      }
    }, 'recreated node ready')
  }
  if (partitionDirectory) {
    if (!partitionDirectory.startsWith('/tmp/voxels-node-sync-')) throw Error('Partition test is restricted to throwaway sync nodes')
    originalEnv = await readFile(partitionDirectory + '/app.env', 'utf8')
    await writeFile(partitionDirectory + '/app.env', originalEnv.replace(/^FEDERATION_PEERS=.*$/m, 'FEDERATION_PEERS='))
    await recreate()
  }
  try {
    const featureA = 'sync-a-' + randomUUID(),
      featureB = 'sync-b-' + randomUUID()
    const ea = await submit(a, { features: { [featureA]: { uuid: featureA, type: 'cube', position: [1, 2, 3], scale: [1, 1, 1] } } })
    const eb = await submit(b, { features: { [featureB]: { uuid: featureB, type: 'cube', position: [4, 2, 3], scale: [1, 1, 1] } } })
    if (partitionDirectory) {
      await new Promise((r) => setTimeout(r, 3000))
      assert.equal(await has(a, eb), false)
      assert.equal(await has(b, ea), false)
      console.log('PASS both disconnected hosts accept and retain independent edits')
      await writeFile(partitionDirectory + '/app.env', originalEnv!)
      await recreate()
    }
    await waitFor(async () => (await has(a, eb)) && (await has(b, ea)), 'bidirectional edit propagation')
    const getContent = (base: string) =>
      fetch(base + '/grid/parcels/1?smoke=' + Date.now())
        .then((r) => r.json())
        .then((r) => ({ features: r.parcel.features, voxels: r.parcel.voxels, palette: r.parcel.palette, brightness: r.parcel.brightness }))
    const firstContent = await getContent(a),
      secondContent = await getContent(b)
    assert.deepEqual(firstContent, secondContent)
    assert.ok(firstContent.features.some((x: any) => x.uuid === featureA))
    assert.ok(firstContent.features.some((x: any) => x.uuid === featureB))
    assert.equal((await fetch(a + '/federation/edits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ea) })).status, 200)
    const missing = { ...ea, parent: id('unknown-parent'), nonce: randomUUID().replaceAll('-', '') }
    missing.signature = await wallet.signMessage(editMessage(missing))
    assert.equal((await fetch(a + '/federation/edits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(missing) })).status, 400)
    const bad = { ...ea, patches: [{ brightness: 9 }] }
    assert.equal((await fetch(b + '/federation/edits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bad) })).status, 400)
    console.log('PASS signed edits propagate both ways; forged edit rejected; parcel states converge')
    const sockets: WebSocket[] = []
    async function connect(base: string) {
      const uuid = randomUUID(),
        ws = new WebSocket(base.replace('http', 'ws') + '/socket?client_uuid=' + uuid)
      sockets.push(ws)
      const received: messages.Message[] = []
      ws.on('message', (data) => {
        const decoded = messages.decode(data)
        if (decoded.type === 'success') received.push(decoded.message)
      })
      await new Promise<void>((resolve, reject) => {
        ws.once('open', () => resolve())
        ws.once('error', reject)
      })
      ws.send(messages.encode({ type: messages.MessageType.anon }))
      await waitFor(async () => received.some((m) => m.type === messages.MessageType.loginComplete), 'guest login')
      return { ws, uuid, received }
    }
    try {
      const ca = await connect(a),
        cb = await connect(b)
      ca.ws.send(messages.encode({ type: messages.MessageType.updateAvatar, uuid: ca.uuid, position: [1, 2, 3], orientation: [0, 0, 0, 1], animation: 0 }))
      cb.ws.send(messages.encode({ type: messages.MessageType.updateAvatar, uuid: cb.uuid, position: [4, 2, 3], orientation: [0, 0, 0, 1], animation: 0 }))
      const aid = remotePlayerId(info.node, ca.uuid),
        bid = remotePlayerId(second.node, cb.uuid)
      await waitFor(
        async () =>
          ca.received.some((m: any) => m.type === messages.MessageType.worldState && m.avatars.some((x: any) => x.uuid === bid)) &&
          cb.received.some((m: any) => m.type === messages.MessageType.worldState && m.avatars.some((x: any) => x.uuid === aid)),
        'cross-host player presence',
      )
      console.log('PASS players on separate hosts see remote positions')
      const late = await connect(a)
      assert.ok(late.received.some((m: any) => m.type === messages.MessageType.join && m.createAvatars.some((x: any) => x.uuid === bid)))
      console.log('PASS new local player receives existing remote avatars')
      cb.ws.terminate()
      await waitFor(async () => ca.received.some((m: any) => m.type === messages.MessageType.destroyAvatar && m.uuid === bid), 'remote departure cleanup')
      console.log('PASS remote player departure removes avatar')
    } finally {
      for (const ws of sockets) ws.terminate()
    }
  } finally {
    if (originalEnv) await writeFile(partitionDirectory + '/app.env', originalEnv)
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
