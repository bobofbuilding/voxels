/* Public world media only. Never caches pages, sessions, scripts or private requests. */
const CACHE = 'voxels-public-media-v1'
const STATE_CACHE = 'voxels-media-preferences-v1'
let stateWrites = Promise.resolve()
const LIMIT = 256_000_000
const MAX_FILE = 16_000_000
const clientsState = new Map()
let writes = Promise.resolve()
let pendingWrites = 0
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('message', (event) => {
  event.waitUntil(stateWrites = stateWrites.catch(() => {}).then(async () => {
  if (!event.source?.id) return
  let state = await loadState(event.source.id)
  if (!state) { state = { sharing: false, urls: new Map() }; clientsState.set(event.source.id, state) }
  const data = event.data
  if (data?.type === 'sharing') state.sharing = data.enabled === true
  if (data?.type === 'parcel-media' && Number.isSafeInteger(data.parcel) && data.parcel > 0 && Array.isArray(data.urls)) {
    for (const input of data.urls.slice(0, 2048)) {
      try {
        const url = new URL(input)
        if (!['http:', 'https:'].includes(url.protocol) || url.origin === self.location.origin || url.username || url.password) continue
        state.urls.set(url.href, data.parcel)
        if (state.urls.size > 8192) state.urls.delete(state.urls.keys().next().value)
      } catch {}
    }
  }
  const cache = await caches.open(STATE_CACHE)
  await cache.put(new URL('/_media-client/' + event.source.id, self.location.origin).href, new Response(JSON.stringify({ sharing: state.sharing, urls: [...state.urls] })))
  const active = new Set((await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })).map(client => client.id))
  for (const key of await cache.keys()) if (!active.has(new URL(key.url).pathname.split('/').pop())) await cache.delete(key)
  for (const id of clientsState.keys()) if (!active.has(id)) clientsState.delete(id)
  }).catch(() => {}))
})
async function loadState(id) {
  if (!id) return null
  if (clientsState.has(id)) return clientsState.get(id)
  try {
    const cached = await (await caches.open(STATE_CACHE)).match(new URL('/_media-client/' + id, self.location.origin).href)
    if (cached) { const data = await cached.json(); const state = { sharing: data.sharing === true, urls: new Map(data.urls) }; clientsState.set(id, state); return state }
  } catch {}
  return null
}
async function store(request, response) {
  const size = Number(response.headers.get('content-length'))
  if (response.status !== 200 || !Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE || /private|no-store/i.test(response.headers.get('cache-control') || '')) return
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength !== size) return
  const cache = await caches.open(CACHE)
  let used = 0
  const keys = await cache.keys()
  for (const key of keys) { const old = await cache.match(key); used += Number(old?.headers.get('content-length') || 0) }
  for (const key of keys) {
    if (used + size <= LIMIT) break
    const old = await cache.match(key); used -= Number(old?.headers.get('content-length') || 0); await cache.delete(key)
  }
  const headers = new Headers(response.headers)
  headers.set('X-Voxels-Stored-At', String(Date.now()))
  await cache.put(request, new Response(buffer, { status: 200, headers }))
}
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (new URL(request.url).origin === self.location.origin || request.method !== 'GET' || request.credentials === 'include' || request.headers.has('authorization') || request.mode === 'navigate' || ['document', 'script', 'worker', 'iframe'].includes(request.destination)) return
  event.respondWith((async () => {
    await stateWrites
    const state = await loadState(event.clientId)
    const parcel = state?.urls.get(request.url)
    if (!parcel) return fetch(request)
    const cache = await caches.open(CACHE)
    let hit = !request.headers.has('range') && await cache.match(request.url)
    if (hit && Date.now() - Number(hit.headers.get('X-Voxels-Stored-At') || 0) > 86400000) { await cache.delete(request.url); hit = null }
    // When sharing is enabled, visit the host even on a browser cache hit, so it can retain its own copy.
    if (hit && !state.sharing) return hit
    let response
    if (state.sharing) {
      try {
        const range = request.headers.get('range')
        const host = await fetch(`/media-cache/asset?parcel=${parcel}&url=${encodeURIComponent(request.url)}`, { credentials: 'omit', cache: 'no-store', headers: range ? { Range: range } : {}, signal: request.signal })
        if (host.ok && host.headers.has('x-voxels-cache')) response = host
      } catch {}
    }
    if (!response) { if (hit) return hit; response = await fetch(request) }
    const size = Number(response.headers.get('content-length'))
    if (pendingWrites < 2 && !request.headers.has('range') && response.type !== 'opaque' && response.status === 200 && size > 0 && size <= MAX_FILE) {
      const copy = response.clone()
      pendingWrites++
      writes = writes.catch(() => {}).then(() => store(request.url, copy)).catch(() => {}).finally(() => { pendingWrites-- })
      event.waitUntil(writes)
    }
    return response
  })().catch(() => fetch(request)))
})
