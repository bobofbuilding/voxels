type Entry = { url: string; expires: number; response: Promise<Response> }
const cache = new Map<string, Entry>()
const DEFAULT_TTL = 60
const MAX_ENTRIES = 256

export function clearCache() {
  cache.clear()
}

export async function invalidateUrl(url: string, refetch = false) {
  const wildcard = url.endsWith('*')
  const prefix = wildcard ? url.slice(0, -1) : url
  for (const [key, entry] of cache) {
    if (wildcard ? entry.url.startsWith(prefix) : entry.url === url) cache.delete(key)
  }
  if (refetch && !wildcard) await cachedFetch(url, { cache: 'reload' })
}

function reloadUrl(url: string) {
  const parsed = new URL(url, globalThis.location?.href || 'http://localhost')
  parsed.searchParams.set('nonce', Math.random().toString())
  return /^https?:\/\//i.test(url) || url.startsWith('//') ? parsed.href : parsed.pathname + parsed.search + parsed.hash
}

async function fetchResponse(url: string, opts: RequestInit) {
  const response = await fetch(opts.cache === 'reload' ? reloadUrl(url) : url, opts)
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`)
  return response
}

// A caller can cancel its wait without cancelling another caller's shared request.
function waitResponse(request: Promise<Response>, signal?: AbortSignal | null): Promise<Response> {
  if (!signal) return request.then((response) => response.clone())
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    request.then(
      (response) => {
        signal.removeEventListener('abort', abort)
        if (!signal.aborted) resolve(response.clone())
      },
      (error) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
}

export default async function cachedFetch(url: string, opts: RequestInit = {}, ttlSeconds = DEFAULT_TTL): Promise<Response> {
  if (opts.signal?.aborted) throw opts.signal.reason
  const method = (opts.method || 'GET').toUpperCase()
  if (method !== 'GET' || opts.body || opts.cache === 'no-store' || ttlSeconds <= 0) return fetchResponse(url, opts)

  const key = JSON.stringify([url, [...new Headers(opts.headers).entries()].sort(), opts.credentials || 'same-origin', opts.mode || 'cors', opts.redirect || 'follow', opts.integrity || '', opts.referrer || '', opts.referrerPolicy || ''])
  const now = Date.now()
  for (const [key, entry] of cache) if (entry.expires <= now) cache.delete(key)
  const hit = cache.get(key)
  if (hit && opts.cache !== 'reload' && opts.cache !== 'no-cache') return waitResponse(hit.response, opts.signal)

  const request = fetchResponse(url, { ...opts, signal: undefined })
  const entry: Entry = { url, expires: Infinity, response: request }
  entry.response = request.then(
    async (response) => {
      try {
        const json = await response.clone().json()
        if (json?.success === false) {
          if (cache.get(key) === entry) cache.delete(key)
        } else {
          entry.expires = Date.now() + ttlSeconds * 1000
        }
        return response
      } catch (error) {
        if (cache.get(key) === entry) cache.delete(key)
        throw error
      }
    },
    (error) => {
      if (cache.get(key) === entry) cache.delete(key)
      throw error
    },
  )
  cache.set(key, entry)
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!)
  return waitResponse(entry.response, opts.signal)
}
