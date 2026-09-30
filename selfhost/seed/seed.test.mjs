import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { generateKeyPairSync } from 'node:crypto'
import { publish, mirror, serve, verifyLocal } from './seed.mjs'

test('signed archive can be mirrored, repaired, and rejects untrusted signatures', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'voxels-seed-'))
  let server
  try {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    await writeFile(path.join(root, 'key'), privateKey.export({ type: 'pkcs8', format: 'pem' }))
    await writeFile(path.join(root, 'public'), publicKey.export({ type: 'spki', format: 'pem' }))
    await writeFile(path.join(root, 'source'), Buffer.alloc(8 * 1024 * 1024 + 13, 42))
    const source = path.join(root, 'seed')
    const destination = path.join(root, 'mirror')
    const snapshot = await publish(path.join(root, 'source'), source, path.join(root, 'key'))
    assert.equal(snapshot.chunks, 2)
    const restored = path.join(root, 'restored')
    await verifyLocal(source, snapshot.manifest, path.join(root, 'public'), restored)
    assert.deepEqual(await readFile(restored), await readFile(path.join(root, 'source')))
    await assert.rejects(verifyLocal(source, snapshot.manifest, path.join(root, 'public'), restored), /EEXIST/)
    server = serve(source, 0)
    await new Promise((resolve) => server.once('listening', resolve))
    const url = `http://127.0.0.1:${server.address().port}/`
    assert.deepEqual(await mirror(url, snapshot.manifest, path.join(root, 'public'), destination), { manifest: snapshot.manifest, bytes: 8 * 1024 * 1024 + 13 })
    const manifest = JSON.parse(await readFile(path.join(source, 'manifests', snapshot.manifest)))
    await writeFile(path.join(destination, 'chunks', manifest.chunks[0].sha256), 'corrupt')
    await mirror(url, snapshot.manifest, path.join(root, 'public'), destination)
    assert.equal((await readFile(path.join(destination, 'chunks', manifest.chunks[0].sha256))).length, 8 * 1024 * 1024)
    await assert.rejects(mirror(url, snapshot.manifest, path.join(root, 'public'), destination, 10), /budget/)
    await writeFile(path.join(source, 'manifests', snapshot.manifest + '.sig'), Buffer.alloc(64).toString('base64'))
    await assert.rejects(mirror(url, snapshot.manifest, path.join(root, 'public'), destination), /signature/)
    assert.equal((await fetch(url + '%2e%2e/key')).status, 404)
    assert.equal((await fetch(url + 'latest.json', { method: 'POST' })).status, 405)
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})
