import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
test('world gateway preserves authenticated request bodies and queries and blocks bulk archive routes', async () => {
  const backend = http.createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    res.setHeader('Set-Cookie', 'test=ok; HttpOnly')
    res.end(JSON.stringify({ url: req.url, method: req.method, cookie: req.headers.cookie, body }))
  })
  backend.listen(0, '127.0.0.1')
  await once(backend, 'listening')
  const child = spawn(process.execPath, [new URL('./gateway.mjs', import.meta.url).pathname], { env: { ...process.env, GATEWAY_PORT: '0', WORLD_PORT: String(backend.address().port) }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const line = await Promise.race([once(child.stdout, 'data'), new Promise((_, reject) => setTimeout(() => reject(Error('startup timeout')), 5000).unref())])
    const port = JSON.parse(String(line[0])).port
    const base = `http://127.0.0.1:${port}`
    const root = await fetch(base + '/?parcel=1', { redirect: 'manual' })
    assert.equal(root.status, 302)
    assert.equal(root.headers.get('location'), '/play?parcel=1')
    const response = await fetch(base + '/api/test?a=1', { method: 'POST', headers: { Cookie: 'jwt=test', 'Content-Type': 'application/json' }, body: '{"ok":true}' })
    assert.deepEqual(await response.json(), { url: '/api/test?a=1', method: 'POST', cookie: 'jwt=test', body: '{"ok":true}' })
    assert.match(response.headers.get('set-cookie'), /HttpOnly/)
    assert.equal((await fetch(base + '/archive/chunks/secret')).status, 404)
  } finally {
    child.kill()
    await once(child, 'exit')
    backend.closeAllConnections()
    await new Promise((r) => backend.close(r))
  }
})
