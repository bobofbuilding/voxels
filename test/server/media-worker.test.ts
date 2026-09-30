// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const script = readFileSync('dist/world-media-worker.js', 'utf8')
function storage() {
  const stores = new Map<string, Map<string, Response>>()
  return {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const data = stores.get(name)!
      const key = (request: string | Request) => (typeof request === 'string' ? request : request.url)
      return {
        match: async (request: string | Request) => data.get(key(request))?.clone(),
        put: async (request: string | Request, response: Response) => {
          data.set(key(request), response.clone())
        },
        keys: async () => [...data.keys()].map((k) => new Request(k)),
        delete: async (request: string | Request) => data.delete(key(request)),
      }
    },
  }
}
function worker(caches = storage()) {
  const handlers = new Map<string, Function>()
  const fetch = vi.fn(async (..._args: any[]) => new Response('abc', { headers: { 'content-length': '3', 'content-type': 'image/png', 'x-voxels-cache': 'pi-fill' } }))
  vm.runInNewContext(script, {
    URL,
    Headers,
    Response,
    Request,
    Map,
    Set,
    Promise,
    Date,
    Number,
    Array,
    encodeURIComponent,
    fetch,
    caches,
    self: {
      location: { origin: 'https://world.example' },
      addEventListener: (name: string, handler: Function) => handlers.set(name, handler),
      clients: { matchAll: async () => [{ id: 'visitor' }], claim: async () => {} },
      skipWaiting: async () => {},
    },
  })
  return {
    fetch,
    caches,
    message: async (data: unknown) => {
      let pending: Promise<any> = Promise.resolve()
      handlers.get('message')!({
        source: { id: 'visitor' },
        data,
        waitUntil: (p: Promise<any>) => {
          pending = p
        },
      })
      await pending
    },
    request: async (url: string, options: RequestInit = {}) => {
      let response: Promise<Response> | undefined
      const pending: Promise<any>[] = []
      handlers.get('fetch')!({
        clientId: 'visitor',
        request: new Request(url, { credentials: 'omit', ...options }),
        respondWith: (p: Promise<Response>) => {
          response = p
        },
        waitUntil: (p: Promise<any>) => pending.push(p),
      })
      const result = await response
      await Promise.all(pending)
      return result
    },
  }
}
const url = 'https://media.example/public.png'
test('automatic browser caching does not contact the host until sharing is enabled', async () => {
  const w = worker()
  await w.message({ type: 'parcel-media', parcel: 1, urls: [url] })
  expect(await (await w.request(url))!.text()).toBe('abc')
  expect(w.fetch.mock.calls[0][0]).toBeInstanceOf(Request)
  await w.request(url)
  expect(w.fetch).toHaveBeenCalledTimes(1)
  await w.message({ type: 'sharing', enabled: true })
  await w.request(url)
  expect(w.fetch.mock.calls[1][0]).toContain('/media-cache/asset?parcel=1')
})
test('sharing preferences survive a worker restart and credentialed requests bypass the cache', async () => {
  const first = worker()
  await first.message({ type: 'parcel-media', parcel: 1, urls: [url] })
  await first.message({ type: 'sharing', enabled: true })
  const restarted = worker(first.caches)
  await restarted.request(url)
  expect(restarted.fetch.mock.calls[0][0]).toContain('/media-cache/asset?parcel=1')
  expect(await restarted.request(url, { credentials: 'include' })).toBeUndefined()
  expect(await restarted.request(url, { headers: { Authorization: 'secret' } })).toBeUndefined()
  expect(restarted.fetch).toHaveBeenCalledTimes(1)
})

test('an unavailable or old host falls back to the original media, never an HTML application page', async () => {
  const w = worker()
  await w.message({ type: 'parcel-media', parcel: 1, urls: [url] })
  await w.message({ type: 'sharing', enabled: true })
  w.fetch.mockImplementationOnce(async () => new Response('<html>old host</html>'))
  expect(await (await w.request(url))!.text()).toBe('abc')
  expect(w.fetch).toHaveBeenCalledTimes(2)
  expect(w.fetch.mock.calls[1][0]).toBeInstanceOf(Request)
})
