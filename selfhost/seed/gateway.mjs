import http from 'node:http'
import net from 'node:net'
import { readFile } from 'node:fs/promises'
const root = process.env.SEED_ROOT
const hostname = process.env.PUBLIC_HOST || 'bittrees.world'
const active = new Set()
function fail(res, code) {
  res.writeHead(code, { 'Cache-Control': 'no-store' }).end()
}
function proxy(req, res, port, pathname) {
  const upstream = http.request({ hostname: '127.0.0.1', port, path: pathname, method: req.method, timeout: 10000 }, (reply) => {
    res.writeHead(reply.statusCode, { ...reply.headers, 'X-Content-Type-Options': 'nosniff' })
    reply.pipe(res)
  })
  upstream.on('timeout', () => upstream.destroy())
  upstream.on('error', () => {
    if (!res.headersSent) fail(res, 502)
    else res.destroy()
  })
  res.on('close', () => upstream.destroy())
  upstream.end()
}
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) return fail(res, 405)
  const pathname = new URL(req.url, 'http://localhost').pathname
  if (pathname === '/') {
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Bittrees World — Voxels archive</title><style>body{font:18px system-ui;margin:8vh auto;padding:0 24px;max-width:760px;background:#f4f2eb;color:#223629}h1{font-size:48px;letter-spacing:-2px}a{color:#235c43}small{color:#526153}.facts{display:flex;gap:36px;flex-wrap:wrap;padding:24px 0;border-block:1px solid #c9d0c6}.facts b{font-size:28px;display:block}p{line-height:1.6}code{overflow-wrap:anywhere}</style><small>BITTREES WORLD · COMMUNITY ARCHIVE PILOT</small><h1>A world worth keeping.</h1><p>A public Voxels build archive, designed for anyone to verify and seed from a small computer.</p><div class="facts"><div><b>8,807</b>public parcels</div><div><b>485,181</b>saved versions</div><div><b>4.67 GB</b>initial snapshot</div></div><p>This snapshot contains parcel builds and saved history. External images, video and other media are not included yet.</p><p>The multiplayer pilot runs on a Raspberry Pi. This page is the archive and service entry point; the playable world client is not deployed here yet.</p><p><a href="/archive/latest.json">Snapshot manifest reference</a> · <a href="https://github.com/bobofbuilding/voxels/tree/codex/pi-world-seed/selfhost/seed">Seeding instructions</a> · <a href="/socket/info">Multiplayer service</a></p><p><small>Public archive data is kept separate from live player activity. Bulk archive sharing uses peer connections; this public endpoint serves metadata and multiplayer traffic.</small></p></html>`
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'", 'Cache-Control': 'no-cache' })
    return res.end(req.method === 'HEAD' ? undefined : html)
  }
  if (['/ping', '/socket/info', '/api/active-parcels.json'].includes(pathname) || /^\/api\/parcels\/\d+\.json$/.test(pathname)) return proxy(req, res, 13780, pathname)
  if (/^\/archive\/(?:latest\.json|publisher\.pem|manifests\/[a-f0-9]{64}(?:\.sig)?)$/.test(pathname)) return proxy(req, res, 8788, pathname.slice('/archive'.length))
  if (pathname === '/health') {
    try {
      await readFile(root + '/verified.json')
      const ping = await fetch('http://127.0.0.1:13780/ping', { signal: AbortSignal.timeout(2000) })
      if (!ping.ok) throw Error('Multiplayer unavailable')
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ archive: 'verified', multiplayer: 'running', connections: active.size }))
    } catch {
      fail(res, 503)
    }
    return
  }
  fail(res, 404)
})
server.on('upgrade', (req, client, head) => {
  const url = new URL(req.url, 'http://localhost')
  const id = url.searchParams.get('client_uuid')
  if (url.pathname !== '/socket' || !id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || active.has(id) || active.size >= 32 || (req.headers.origin && req.headers.origin !== `https://${hostname}`)) {
    client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
    return
  }
  active.add(id)
  const upstream = net.connect(13780, '127.0.0.1')
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
    let headers = `GET /socket?client_uuid=${encodeURIComponent(id)} HTTP/1.1\r\nHost: 127.0.0.1:13780\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n`
    for (const name of ['sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol']) if (req.headers[name]) headers += `${name}: ${req.headers[name]}\r\n`
    upstream.write(headers + '\r\n')
    if (head.length) upstream.write(head)
    client.pipe(upstream)
    upstream.pipe(client)
  })
})
server.headersTimeout = 10000
server.requestTimeout = 15000
server.maxConnections = 64
server.listen(8787, '127.0.0.1')
