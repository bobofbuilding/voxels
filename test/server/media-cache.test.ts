// @vitest-environment node
import { afterEach, expect, test } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { MediaStore, mediaKey } from '../../server/media-cache/store'
import { publicIPv4, mediaType, privateCookies } from '../../server/media-cache/upstream'
import { parcelMediaUrls, publicMediaUrl } from '../../common/media-cache'
const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true })
})
async function fixture(online = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voxels-media-test-'))
  roots.push(root)
  const options = { hot: path.join(root, 'local'), cold: path.join(root, 'nas'), hotLimit: 20000, coldLimit: 20000, headroom: 0, coldAvailable: async () => online }
  await fs.mkdir(options.cold)
  const store = new MediaStore(options)
  await store.initialize()
  return { store, options }
}
const details = { type: 'image/png', status: 200 }
test('in-flight reservations enforce the node cap and overflow goes to NAS', async () => {
  const { store } = await fixture()
  const first = await store.begin(mediaKey('one'), 11000, details)
  const second = await store.begin(mediaKey('two'), 10000, details)
  expect(first?.tier).toBe('local')
  expect(second?.tier).toBe('archive')
  expect(store.hotBytes + store.reservedHot).toBeLessThanOrEqual(20000)
  await first!.write(Buffer.alloc(11000, 1))
  await second!.write(Buffer.alloc(10000, 2))
  await Promise.all([first!.finish(), second!.finish()])
  expect(store.hotBytes).toBeLessThanOrEqual(20000)
  expect((await store.find(mediaKey('two')))?.tier).toBe('archive')
})
test('NAS outage and full storage preserve existing files instead of spilling onto the node', async () => {
  const { store, options } = await fixture(false)
  const first = await store.begin(mediaKey('one'), 11000, details)
  await first!.write(Buffer.alloc(11000, 1))
  await first!.finish()
  expect(await store.begin(mediaKey('two'), 10000, details)).toBe(null)
  expect(await store.find(mediaKey('one'))).not.toBe(null)
  options.coldAvailable = async () => true
  // A NAS absent at startup must be reconciled on restart before accepting writes.
  expect(await store.begin(mediaKey('two'), 10000, details)).toBe(null)
})
test('partial writes release reservations and identical completed content is deduplicated', async () => {
  const { store } = await fixture()
  const partial = await store.begin(mediaKey('partial'), 1000, details)
  await partial!.write(Buffer.alloc(20))
  await partial!.abort()
  expect(store.reservedHot).toBe(0)
  expect(await store.find(mediaKey('partial'))).toBe(null)
  const a = await store.begin(mediaKey('a'), 1000, details),
    b = await store.begin(mediaKey('b'), 1000, details)
  await a!.write(Buffer.alloc(1000, 3))
  await b!.write(Buffer.alloc(1000, 3))
  const [aa, bb] = await Promise.all([a!.finish(), b!.finish()])
  expect(aa!.hash).toBe(bb!.hash)
  expect((await fs.readdir(store.options.hot)).filter((n) => /^[a-f0-9]{64}$/.test(n))).toHaveLength(1)
  expect(store.hotBytes).toBeLessThan(2000)
})
test('restart restores usage and range-specific entries without deleting completed media', async () => {
  const { store, options } = await fixture()
  const key = mediaKey('movie', 'bytes=0-999')
  const writer = await store.begin(key, 1000, { ...details, status: 206, range: 'bytes 0-999/9000' })
  await writer!.write(Buffer.alloc(1000, 4))
  await writer!.finish()
  const reopened = new MediaStore(options)
  await reopened.initialize()
  expect(reopened.hotBytes).toBe(store.hotBytes)
  expect((await reopened.find(key))?.status).toBe(206)
  expect(await reopened.find(mediaKey('movie', 'bytes=1000-1999'))).toBe(null)
})
test('private networks, credential-bearing URLs and active content are excluded', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.1.1', '192.168.1.164', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '224.0.0.1', '192.0.2.1', '198.51.100.1']) expect(publicIPv4(ip)).toBe(false)
  expect(publicIPv4('1.1.1.1')).toBe(true)
  for (const url of ['file:///etc/passwd', 'https://user:secret@example.com/a.png', 'https://example.com/a.png?token=secret', 'https://example.com:1234/a']) expect(publicMediaUrl(url)).toBe(null)
  expect(mediaType('image/svg+xml')).toBe(null)
  expect(mediaType('text/html')).toBe(null)
  expect(privateCookies(['session=secret'])).toBe(true)
  expect(privateCookies(['__cf_bm=discarded; Secure'])).toBe(false)
  expect(mediaType('image/png')).toBe('image/png')
  expect(parcelMediaUrls({ url: 'ugc://parcel/model.glb' })).toEqual(['https://ugc.voxels.com/parcel/model.glb'])
  expect(parcelMediaUrls({ features: [{ url: 'https://example.com/a.png', script: 'https://example.com/private' }] })).toEqual(['https://example.com/a.png'])
})

test('a missing cached payload is recovered rather than trusting a stale deduplication entry', async () => {
  const { store } = await fixture()
  const first = await store.begin(mediaKey('first'), 100, details)
  await first!.write(Buffer.alloc(100, 7))
  const entry = await first!.finish()
  await fs.unlink(store.filename(entry!))
  expect(await store.find(mediaKey('first'))).toBe(null)
  const retry = await store.begin(mediaKey('retry'), 100, details)
  await retry!.write(Buffer.alloc(100, 7))
  const recovered = await retry!.finish()
  expect(await fs.readFile(store.filename(recovered!))).toEqual(Buffer.alloc(100, 7))
})
