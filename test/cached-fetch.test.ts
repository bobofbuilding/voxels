import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import cachedFetch, { clearCache, invalidateUrl } from '../web/src/helpers/cached-fetch'

const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
beforeEach(() => clearCache())
afterEach(() => vi.unstubAllGlobals())

test('reload keeps existing query parameters', async () => {
  const fetch = vi.fn().mockResolvedValue(response({ success: true }))
  vi.stubGlobal('fetch', fetch)
  await cachedFetch('/api/events.json?sort=newest&limit=3', { cache: 'reload' })
  const url = new URL(fetch.mock.calls[0][0], 'http://localhost')
  expect(url.searchParams.get('sort')).toBe('newest')
  expect(url.searchParams.get('limit')).toBe('3')
  expect(url.searchParams.has('nonce')).toBe(true)
})

test('concurrent GET callers share a request and can read their own response', async () => {
  const fetch = vi.fn().mockResolvedValue(response({ success: true, value: 7 }))
  vi.stubGlobal('fetch', fetch)
  const [a, b] = await Promise.all([cachedFetch('/api/example'), cachedFetch('/api/example')])
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(await a.json()).toEqual(await b.json())
})

test('writes always reach the server even when the URL is cached', async () => {
  const fetch = vi.fn().mockImplementation(async () => response({ success: true }))
  vi.stubGlobal('fetch', fetch)
  await cachedFetch('/api/example')
  await cachedFetch('/api/example', { method: 'POST', body: '{}' })
  await cachedFetch('/api/example', { method: 'POST', body: '{}' })
  expect(fetch).toHaveBeenCalledTimes(3)
})

test('invalidating an in-flight request prevents it from repopulating the cache', async () => {
  let resolve!: (r: Response) => void
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    .mockImplementation(async () => response({ value: 'new' }))
  vi.stubGlobal('fetch', fetch)
  const old = cachedFetch('/api/example')
  await invalidateUrl('/api/*')
  resolve(response({ value: 'old' }))
  await old
  expect(await (await cachedFetch('/api/example')).json()).toEqual({ value: 'new' })
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('one cancelled caller does not cancel the shared request', async () => {
  let resolve!: (r: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    ),
  )
  const controller = new AbortController()
  const first = cachedFetch('/api/example', { signal: controller.signal })
  const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' })
  const second = cachedFetch('/api/example')
  controller.abort()
  resolve(response({ success: true }))
  await cancelled
  expect(await (await second).json()).toEqual({ success: true })
})

test('failed API responses are not cached', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response({ success: false }))
    .mockResolvedValueOnce(response({ success: true }))
  vi.stubGlobal('fetch', fetch)
  await cachedFetch('/api/example')
  expect(await (await cachedFetch('/api/example')).json()).toEqual({ success: true })
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('different authorization headers and session changes cannot reuse cached data', async () => {
  const fetch = vi.fn().mockImplementation(async () => response({ success: true }))
  vi.stubGlobal('fetch', fetch)
  await cachedFetch('/api/example', { headers: { Authorization: 'Bearer one' } })
  await cachedFetch('/api/example', { headers: { Authorization: 'Bearer two' } })
  clearCache()
  await cachedFetch('/api/example', { headers: { Authorization: 'Bearer two' } })
  expect(fetch).toHaveBeenCalledTimes(3)
})
