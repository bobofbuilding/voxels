// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest'
import { Writable, Readable } from 'node:stream'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
vi.mock('../../server/pg', () => ({ default: { query: vi.fn() } }))
vi.mock('../../server/media-cache/upstream', async (original) => ({ ...(await original<any>()), openPublicMedia: vi.fn() }))
import db from '../../server/pg'
import { openPublicMedia } from '../../server/media-cache/upstream'
import { installMediaCache } from '../../server/media-cache/routes'
const directories: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  for (const d of directories.splice(0)) await fs.rm(d, { recursive: true, force: true })
})
class Response extends Writable {
  code = 200
  headersSent = false
  headers: Record<string, unknown> = {}
  chunks: Buffer[] = []
  status(code: number) {
    this.code = code
    return this
  }
  setHeader(key: string, value: unknown) {
    this.headers[key] = value
    return this
  }
  json(value: unknown) {
    this.end(JSON.stringify(value))
    return this
  }
  _write(chunk: Buffer, _encoding: string, cb: () => void) {
    this.headersSent = true
    this.chunks.push(Buffer.from(chunk))
    cb()
  }
}
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voxels-media-route-'))
  directories.push(root)
  vi.stubEnv('MEDIA_CACHE_HOT', root)
  vi.stubEnv('MEDIA_CACHE_HOT_BYTES', '100000')
  const routes = new Map<string, Function>()
  installMediaCache({ get: (url: string, ...handlers: Function[]) => routes.set(url, handlers.at(-1)!) } as any)
  return async (query: any, range?: string) => {
    const response = new Response()
    await routes.get('/media-cache/asset')!({ query, headers: range ? { range } : {} }, response)
    return response
  }
}
const url = 'https://example.com/public.png'
test('private parcels and unreferenced URLs never trigger a source fetch', async () => {
  const request = await fixture()
  vi.mocked(db.query).mockResolvedValue({ rows: [] } as any)
  expect((await request({ parcel: 1, url })).code).toBe(403)
  vi.mocked(db.query).mockResolvedValue({ rows: [{ content: { features: [{ url }] } }] } as any)
  expect((await request({ parcel: 1, url: 'https://example.com/unlisted.png' })).code).toBe(403)
  expect(openPublicMedia).not.toHaveBeenCalled()
})
test('public media streams once, then replays cached bytes after rechecking parcel visibility', async () => {
  const request = await fixture()
  vi.mocked(db.query).mockResolvedValue({ rows: [{ content: { features: [{ url }] } }] } as any)
  const body = Buffer.from('test-media-bytes')
  const upstream = Object.assign(Readable.from([body]), { statusCode: 200, headers: { 'content-type': 'image/png', 'content-length': String(body.length), 'x-frames': '{"frames":2,"duration":1}' } })
  vi.mocked(openPublicMedia).mockResolvedValue(upstream as any)
  const first = await request({ parcel: 1, url })
  expect(first.code).toBe(200)
  expect(Buffer.concat(first.chunks)).toEqual(body)
  const second = await request({ parcel: 1, url })
  expect(second.headers['X-Voxels-Cache']).toBe('local')
  expect(second.headers['x-frames']).toBe('{"frames":2,"duration":1}')
  expect(Buffer.concat(second.chunks)).toEqual(body)
  expect(openPublicMedia).toHaveBeenCalledTimes(1)
  vi.mocked(db.query).mockResolvedValue({ rows: [] } as any)
  expect((await request({ parcel: 1, url })).code).toBe(403)
})
test('private source responses and multipart ranges are not shared', async () => {
  const request = await fixture()
  vi.mocked(db.query).mockResolvedValue({ rows: [{ content: { features: [{ url }] } }] } as any)
  const upstream = Object.assign(Readable.from([Buffer.from('secret')]), { statusCode: 200, headers: { 'content-type': 'image/png', 'content-length': '6', 'cache-control': 'private' } })
  vi.mocked(openPublicMedia).mockResolvedValue(upstream as any)
  expect((await request({ parcel: 1, url })).code).toBe(422)
  expect((await request({ parcel: 1, url }, 'bytes=0-2,4-5')).code).toBe(416)
})
