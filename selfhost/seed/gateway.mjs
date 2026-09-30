import http from 'node:http'
import net from 'node:net'
import { readFile } from 'node:fs/promises'
const root = process.env.SEED_ROOT
const hostname = process.env.PUBLIC_HOST || 'bittrees.world'
const active = new Set()
const worldPort = Number(process.env.WORLD_PORT || 19000)
function fail(res, code) {
  res.writeHead(code, { 'Cache-Control': 'no-store' }).end()
}
function proxy(req, res, port, pathname) {
  const upstream = http.request({ hostname: '127.0.0.1', port, path: pathname, method: req.method, headers: { ...req.headers, host: hostname }, timeout: 25000 }, (reply) => {
    res.writeHead(reply.statusCode, { ...reply.headers, 'X-Content-Type-Options': 'nosniff' })
    reply.pipe(res)
  })
  upstream.on('timeout', () => upstream.destroy())
  upstream.on('error', () => {
    if (!res.headersSent) fail(res, 502)
    else res.destroy()
  })
  res.on('close', () => upstream.destroy())
  req.pipe(upstream)
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname
  if (pathname === '/') {
    res.writeHead(302, { Location: '/play' + url.search, 'Cache-Control': 'no-cache' }).end()
    return
  }
  if (pathname === '/archive' || pathname === '/archive/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
    return res.end(
      '<!doctype html><title>Voxels public archive</title><h1>Public world archive</h1><p>8,807 public parcels and 485,181 saved versions. External media is not included.</p><a href="/play">Enter the live world</a> · <a href="/archive/latest.json">Snapshot reference</a> · <a href="https://github.com/bobofbuilding/voxels/tree/codex/pi-world-seed/selfhost/seed">Seeding instructions</a>',
    )
  }
  if (['/ping', '/socket/info', '/mp/socket/info'].includes(pathname)) return proxy(req, res, 13780, pathname.replace(/^\/mp/, '') + url.search)
  if (/^\/archive\/(?:latest\.json|publisher\.pem|manifests\/[a-f0-9]{64}(?:\.sig)?)$/.test(pathname)) return proxy(req, res, 8788, pathname.slice('/archive'.length))
  if (pathname === '/health') {
    try {
      await readFile(root + '/verified.json')
      const ping = await fetch('http://127.0.0.1:13780/ping', { signal: AbortSignal.timeout(2000) })
      const world = await fetch(`http://127.0.0.1:${worldPort}/api/ping`, { signal: AbortSignal.timeout(2000) })
      if (!ping.ok || !world.ok) throw Error('World unavailable')
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ archive: 'verified', world: 'running', multiplayer: 'running', connections: active.size }))
    } catch {
      fail(res, 503)
    }
    return
  }
  if (pathname.startsWith('/archive/')) return fail(res, 404)
  proxy(req, res, worldPort, req.url)
})
server.on('upgrade', (req, client, head) => {
  const url = new URL(req.url, 'http://localhost')
  const grid = url.pathname === '/grid/socket'
  const id = grid ? Symbol('grid') : url.searchParams.get('client_uuid')
  if ((!grid && (!['/socket', '/mp/socket'].includes(url.pathname) || !id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id))) || active.has(id) || active.size >= 64 || (req.headers.origin && req.headers.origin !== `https://${hostname}`)) {
    client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
    return
  }
  active.add(id)
  const port = grid ? worldPort : 13780
  const target = grid ? req.url : '/socket' + url.search
  const upstream = net.connect(port, '127.0.0.1')
  const close = () => {
    active.delete(id)
    client.destroy()
    upstream.destroy()
  }
  client.on('error', close)
  upstream.on('error', close)
  client.on('close', close)
  upstream.on('close', close)
  upstream.setTimeout(90000, close)
  client.setTimeout(90000, close)
  upstream.on('connect', () => {
    let headers = `GET ${target} HTTP/1.1\r\nHost: ${hostname}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n`
    for (const name of ['sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol']) if (req.headers[name]) headers += `${name}: ${req.headers[name]}\r\n`
    upstream.write(headers + '\r\n')
    if (head.length) upstream.write(head)
    client.pipe(upstream)
    upstream.pipe(client)
  })
})
server.headersTimeout = 10000
server.requestTimeout = 15000
server.maxConnections = 128
server.listen(Number(process.env.GATEWAY_PORT || 8787), '127.0.0.1', () => console.log(JSON.stringify({ port: server.address().port })))
