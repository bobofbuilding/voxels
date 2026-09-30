#!/usr/bin/env node
// Portable, dependency-free archive publisher, mirror and read-only seed.
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto'
import { createReadStream } from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const CHUNK = 8 * 1024 * 1024
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const hashPattern = /^[a-f0-9]{64}$/
const canonical = (value) => Buffer.from(JSON.stringify(value) + '\n')
async function put(root, kind, bytes) {
  const hash = digest(bytes)
  await fs.mkdir(path.join(root, kind), { recursive: true })
  const target = path.join(root, kind, hash)
  const existing = await fs.readFile(target).catch((e) => {
    if (e.code !== 'ENOENT') throw e
    return null
  })
  if (!existing || digest(existing) !== hash) {
    await fs.writeFile(target + '.partial', bytes)
    await fs.rename(target + '.partial', target)
  }
  return hash
}
export async function publish(source, root, keyPath, previous = null) {
  if (previous !== null && !hashPattern.test(previous)) throw Error('Invalid previous manifest hash')
  const input = await fs.open(source, 'r')
  const chunks = []
  const whole = createHash('sha256')
  let size = 0
  try {
    for (;;) {
      const buffer = Buffer.alloc(CHUNK)
      let used = 0
      while (used < buffer.length) {
        const { bytesRead } = await input.read(buffer, used, buffer.length - used, null)
        if (!bytesRead) break
        used += bytesRead
      }
      if (!used) break
      const bytes = buffer.subarray(0, used)
      whole.update(bytes)
      chunks.push({ sha256: await put(root, 'chunks', bytes), bytes: used })
      size += used
    }
  } finally {
    await input.close()
  }
  const manifest = {
    format: 'voxels-seed-v1',
    createdAt: new Date().toISOString(),
    previous,
    scope: 'Public parcel builds and saved history; external media not included',
    file: path.basename(source),
    bytes: size,
    sha256: whole.digest('hex'),
    chunks,
  }
  const bytes = canonical(manifest)
  const hash = await put(root, 'manifests', bytes)
  const signature = sign(null, bytes, await fs.readFile(keyPath)).toString('base64')
  await fs.writeFile(path.join(root, 'manifests', hash + '.sig'), signature + '\n')
  await fs.writeFile(path.join(root, 'latest.json.tmp'), canonical({ manifest: hash, createdAt: manifest.createdAt }))
  await fs.rename(path.join(root, 'latest.json.tmp'), path.join(root, 'latest.json'))
  return { manifest: hash, bytes: size, chunks: chunks.length }
}
async function fetchBounded(url, limit) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000), redirect: 'error' })
  if (!res.ok) throw Error(`HTTP ${res.status}: ${url}`)
  const parts = []
  let size = 0
  for await (const piece of res.body) {
    size += piece.length
    if (size > limit) throw Error('Remote response exceeded size limit')
    parts.push(piece)
  }
  return Buffer.concat(parts)
}
export async function mirror(base, hash, publicKeyPath, root, maxBytes = 1e12) {
  if (!hashPattern.test(hash)) throw Error('Pin a manifest SHA-256 from a trusted source')
  const origin = new URL(base)
  if (!['https:', 'http:'].includes(origin.protocol)) throw Error('Use an HTTP(S) seed URL')
  const get = (name, limit) => fetchBounded(new URL(name, origin.href.replace(/\/?$/, '/')), limit)
  const bytes = await get('manifests/' + hash, 16 * 1024 * 1024)
  if (digest(bytes) !== hash) throw Error('Manifest hash mismatch')
  const signature = await get('manifests/' + hash + '.sig', 1024)
  if (!verify(null, bytes, await fs.readFile(publicKeyPath), Buffer.from(signature.toString().trim(), 'base64'))) throw Error('Publisher signature mismatch')
  const manifest = JSON.parse(bytes)
  if (manifest.format !== 'voxels-seed-v1' || !Array.isArray(manifest.chunks) || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 0 || manifest.bytes > maxBytes || !hashPattern.test(manifest.sha256))
    throw Error('Invalid manifest or storage budget exceeded')
  let total = 0
  for (const chunk of manifest.chunks) {
    if (!hashPattern.test(chunk.sha256) || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || chunk.bytes > CHUNK) throw Error('Invalid chunk')
    total += chunk.bytes
  }
  if (total !== manifest.bytes) throw Error('Manifest size mismatch')
  const whole = createHash('sha256')
  for (const chunk of manifest.chunks) {
    let data = await fs.readFile(path.join(root, 'chunks', chunk.sha256)).catch(() => null)
    if (!data || data.length !== chunk.bytes || digest(data) !== chunk.sha256) {
      data = await get('chunks/' + chunk.sha256, chunk.bytes)
      if (data.length !== chunk.bytes || digest(data) !== chunk.sha256) throw Error('Chunk integrity failure')
      await fs.mkdir(path.join(root, 'chunks'), { recursive: true })
      const target = path.join(root, 'chunks', chunk.sha256)
      await fs.writeFile(target + '.partial', data)
      await fs.rename(target + '.partial', target)
    }
    whole.update(data)
  }
  if (whole.digest('hex') !== manifest.sha256) throw Error('Archive integrity failure')
  await put(root, 'manifests', bytes)
  await fs.writeFile(path.join(root, 'manifests', hash + '.sig'), signature)
  return { manifest: hash, bytes: total }
}
export async function verifyLocal(root, hash, publicKeyPath, output) {
  if (!hashPattern.test(hash)) throw Error('Invalid pinned manifest hash')
  const bytes = await fs.readFile(path.join(root, 'manifests', hash))
  const signature = await fs.readFile(path.join(root, 'manifests', hash + '.sig'), 'utf8')
  if (digest(bytes) !== hash || !verify(null, bytes, await fs.readFile(publicKeyPath), Buffer.from(signature.trim(), 'base64'))) throw Error('Manifest authentication failed')
  const manifest = JSON.parse(bytes)
  if (manifest.format !== 'voxels-seed-v1' || !Array.isArray(manifest.chunks)) throw Error('Invalid manifest')
  const destination = output ? await fs.open(output, 'wx', 0o600) : null
  const whole = createHash('sha256')
  let total = 0
  try {
    for (const chunk of manifest.chunks) {
      if (!hashPattern.test(chunk.sha256) || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || chunk.bytes > CHUNK) throw Error('Invalid chunk')
      const data = await fs.readFile(path.join(root, 'chunks', chunk.sha256))
      if (data.length !== chunk.bytes || digest(data) !== chunk.sha256) throw Error('Chunk integrity failure')
      whole.update(data)
      total += data.length
      if (destination) await destination.writeFile(data)
    }
    if (total !== manifest.bytes || whole.digest('hex') !== manifest.sha256) throw Error('Archive integrity failure')
  } catch (error) {
    if (destination) {
      await destination.close()
      await fs.unlink(output)
    }
    throw error
  }
  if (destination) await destination.close()
  return { manifest: hash, bytes: total, verified: true }
}
export function serve(root, port = 8788, host = '127.0.0.1') {
  let active = 0
  const server = http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405).end()
      return
    }
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"service":"voxels-seed","status":"running"}')
      return
    }
    if (!/^\/(?:chunks\/[a-f0-9]{64}|manifests\/[a-f0-9]{64}(?:\.sig)?|latest\.json|publisher\.pem)$/.test(pathname)) {
      res.writeHead(404).end()
      return
    }
    if (active >= 8) {
      res.writeHead(503, { 'Retry-After': '5' }).end()
      return
    }
    active++
    try {
      const target = path.join(root, pathname.slice(1))
      const stat = await fs.lstat(target)
      if (!stat.isFile()) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': pathname.endsWith('.json') || pathname.startsWith('/manifests/') ? 'application/json' : 'application/octet-stream',
        'Cache-Control': pathname === '/latest.json' ? 'no-cache' : 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      })
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      await pipeline(createReadStream(target), res)
    } catch (error) {
      if (!res.headersSent) res.writeHead(error.code === 'ENOENT' ? 404 : 500).end()
      else res.destroy()
    } finally {
      active--
    }
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  server.maxConnections = 32
  server.listen(port, host)
  return server
}
async function main([command, ...args]) {
  if (command === 'keygen') {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    await fs.writeFile(args[0], privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' })
    await fs.writeFile(args[0] + '.pub', publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx' })
  } else if (command === 'publish') console.log(JSON.stringify(await publish(...args)))
  else if (command === 'mirror') console.log(JSON.stringify(await mirror(...args)))
  else if (command === 'verify') console.log(JSON.stringify(await verifyLocal(...args)))
  else if (command === 'serve') serve(args[0], Number(args[1] || 8788), args[2] || '127.0.0.1')
  else throw Error('Usage: seed.mjs keygen KEY | publish FILE ROOT KEY [PREVIOUS_HASH] | mirror URL HASH PUBLIC_KEY ROOT | verify ROOT HASH PUBLIC_KEY [OUTPUT] | serve ROOT [PORT] [HOST]')
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
