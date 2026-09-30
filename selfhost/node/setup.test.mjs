import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { initialize, validate, compose } from './setup.mjs'
const values = { owner: '0x134561f705A9C2DDA470b2246D075Bf7A3c612d2', starter: true, port: '8787', 'public-origin': 'http://localhost:8787', 'expected-parcels': '8807' }
test('installer creates private secrets once, publishes only gateway, and keeps data across shutdown', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'voxels-installer-')),
    directory = path.join(root, 'node')
  try {
    await initialize({ ...values, directory })
    const env = await readFile(path.join(directory, 'app.env'), 'utf8')
    assert.match(env, /JWT_SECRET=[a-f0-9]{64}/)
    assert.equal((await stat(path.join(directory, 'app.env'))).mode & 0o777, 0o600)
    const plan = JSON.parse(await readFile(path.join(directory, 'compose.json'), 'utf8'))
    assert.deepEqual(
      Object.keys(plan.services).filter((name) => plan.services[name].ports),
      ['gateway'],
    )
    assert.deepEqual(plan.services.gateway.ports, ['127.0.0.1:8787:8787'])
    assert.ok(!JSON.stringify(plan).includes(env.match(/JWT_SECRET=(.*)/)[1]))
    await assert.rejects(initialize({ ...values, directory }), /EEXIST/)
    assert.equal(await readFile(path.join(directory, 'app.env'), 'utf8'), env)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test('network identity is stable but unsafe origins and ambiguous bootstrap modes fail', () => {
  assert.equal(validate(values).world, validate({ ...values }).world)
  for (const overrides of [{ owner: '0x' + '0'.repeat(40) }, { inventory: '/tmp/data' }, { 'public-origin': 'http://public.example' }, { peer: ['http://public.example'] }, { world: 'wrong' }])
    assert.throws(() => validate({ ...values, ...overrides }))
  assert.ok(compose({ ...validate(values), build: 'test' }, '/tmp/state').services.bootstrap.volumes.length === 0)
})

test('pinned network setup rejects mismatched island data before creating credentials', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'voxels-network-'))
  try {
    const inventory = path.join(root, 'inventory'),
      network = path.join(root, 'network.json'),
      directory = path.join(root, 'node')
    await mkdir(path.join(inventory, 'builds'), { recursive: true })
    const islands = '{"islands":[]}'
    await writeFile(path.join(inventory, 'islands.json'), islands)
    await writeFile(network, JSON.stringify({ version: 1, editor: values.owner, world: validate(values).world, peers: ['https://world.example'], expectedParcels: 1, islandsSha256: createHash('sha256').update(islands).digest('hex') }))
    await initialize({ ...values, starter: false, inventory, network, directory })
    const config = JSON.parse(await readFile(path.join(directory, 'node.json'), 'utf8'))
    assert.deepEqual(config.peers, ['https://world.example'])
    assert.equal(config.expected, 1)
    await writeFile(path.join(inventory, 'islands.json'), 'changed')
    await assert.rejects(initialize({ ...values, starter: false, inventory, network, directory: path.join(root, 'rejected') }), /differs/)
    await assert.rejects(stat(path.join(root, 'rejected')), /ENOENT/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('partial coverage is explicit, bounded and never implied by hardware', () => {
  const config = validate({ ...values, starter: false, inventory: '/snapshot', world: validate(values).world, 'node-mode': 'partial', parcels: '42,1,42' })
  assert.deepEqual(config.coverage, { mode: 'partial', parcels: [1, 42] })
  assert.deepEqual(validate(values).coverage, { mode: 'full', parcels: null })
  for (const overrides of [{ 'node-mode': 'partial' }, { parcels: '1' }, { 'node-mode': 'partial', parcels: '0' }, { 'node-mode': 'partial', parcels: '1,2' }, { 'node-mode': 'other' }])
    assert.throws(() => validate({ ...values, ...overrides }))
})
