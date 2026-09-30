import type { Express, Response } from 'express'
import { createReadStream } from 'node:fs'
import { once } from 'node:events'
import { pipeline } from 'node:stream/promises'
import rateLimit from 'express-rate-limit'
import db from '../pg'
import { parcelMediaUrls, publicMediaUrl } from '../../common/media-cache'
import { MediaStore, mediaKey, type MediaEntry } from './store'
import { mediaType, openPublicMedia, privateCookies } from './upstream'

const MAX_OBJECT = 2_000_000_000
function positive(value: string | undefined, fallback: number) {
  const n = value === undefined ? fallback : Number(value)
  if (!Number.isSafeInteger(n) || n <= 0) throw Error('Invalid media cache size')
  return n
}
function headers(res: Response, entry: Pick<MediaEntry, 'type' | 'bytes' | 'range' | 'metadata'>) {
  res.setHeader('Content-Type', entry.type)
  res.setHeader('Content-Length', entry.bytes)
  res.setHeader('Cache-Control', 'public, max-age=86400, no-transform')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
  res.setHeader('Content-Disposition', 'attachment')
  if (entry.range) res.setHeader('Content-Range', entry.range)
  for (const key of ['x-frames', 'x-amz-meta-frames', 'x-original-format', 'x-amz-meta-original-format']) if (entry.metadata?.[key]) res.setHeader(key, entry.metadata[key])
}
export function installMediaCache(app: Express) {
  const hot = process.env.MEDIA_CACHE_HOT
  const store = hot ? new MediaStore({ hot, cold: process.env.MEDIA_CACHE_COLD, hotLimit: positive(process.env.MEDIA_CACHE_HOT_BYTES, 75_000_000_000), coldLimit: positive(process.env.MEDIA_CACHE_COLD_BYTES, 900_000_000_000) }) : null
  const ready = store
    ?.initialize()
    .then(() => true)
    .catch((error) => {
      console.error('Media cache unavailable:', error.message)
      return false
    })
  let active = 0
  const filling = new Set<string>()
  const limiter = rateLimit({ windowMs: 60000, max: 180, standardHeaders: true, legacyHeaders: false })
  app.get('/media-cache/status', limiter, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json(store && (await ready) ? await store.status() : { enabled: false })
  })
  app.get('/media-cache/asset', limiter, async (req, res) => {
    let upstream: Awaited<ReturnType<typeof openPublicMedia>> | undefined
    let writer: Awaited<ReturnType<MediaStore['begin']>> = null
    let claimed = false,
      key = ''
    const abort = new AbortController()
    const close = () => {
      if (!res.writableFinished) abort.abort()
    }
    res.on('close', close)
    try {
      if (!store || !(await ready)) return void res.status(503).json({ error: 'Media cache unavailable' })
      const parcel = Number(req.query.parcel),
        url = publicMediaUrl(req.query.url)
      if (!Number.isSafeInteger(parcel) || parcel < 1 || !url) return void res.status(400).json({ error: 'Invalid public media reference' })
      const range = req.headers.range
      if (range && !/^bytes=(?:\d{1,15}-\d{0,15}|-\d{1,15})$/.test(range)) return void res.status(416).end()
      const record = await db.query('media/public-parcel', 'SELECT content FROM properties WHERE id=$1 AND visible=true', [parcel])
      if (!record.rows[0] || !parcelMediaUrls(record.rows[0].content).includes(url)) return void res.status(403).json({ error: 'Media is not referenced by this public parcel' })
      key = mediaKey(url, range)
      const cached = await store.find(key)
      if (cached) {
        headers(res, cached)
        res.status(cached.status)
        res.setHeader('X-Voxels-Cache', cached.tier)
        res.setHeader('ETag', `"sha256-${cached.hash}"`)
        await pipeline(createReadStream(store.filename(cached)), res)
        return
      }
      // Back off to direct origin loading rather than queueing unbounded work on the node.
      if (active >= 2 || filling.has(key)) return void res.status(503).json({ error: 'Media cache busy; load from source' })
      active++
      filling.add(key)
      claimed = true
      upstream = await openPublicMedia(url, range, abort.signal)
      const type = mediaType(upstream.headers['content-type'])
      if (
        ![200, 206].includes(upstream.statusCode || 0) ||
        !type ||
        privateCookies(upstream.headers['set-cookie']) ||
        /private|no-store/i.test(upstream.headers['cache-control'] || '') ||
        (upstream.headers['content-encoding'] && upstream.headers['content-encoding'] !== 'identity')
      ) {
        return void res.status(422).json({ error: 'Source is not eligible for public media caching' })
      }
      const length = Number(upstream.headers['content-length'])
      if (!Number.isSafeInteger(length) || length <= 0 || length > MAX_OBJECT) return void res.status(422).json({ error: 'Media requires a finite size of at most 2 GB; load directly' })
      const contentRange = upstream.headers['content-range']
      if (upstream.statusCode === 206 && (!range || !contentRange || !/^bytes \d+-\d+\/\d+$/.test(contentRange))) return void res.status(422).end()
      const metadata: Record<string, string> = {}
      for (const key of ['x-frames', 'x-amz-meta-frames', 'x-original-format', 'x-amz-meta-original-format']) {
        const value = upstream.headers[key]
        if (typeof value === 'string' && value.length <= 512) metadata[key] = value
      }
      const details = { type, metadata, status: upstream.statusCode!, ...(contentRange ? { range: contentRange } : {}) }
      writer = await store.begin(key, length, details)
      // A full/offline archive does not take down playback or redirect writes to the SD card.
      res.status(upstream.statusCode!)
      headers(res, { ...details, bytes: length })
      res.setHeader('X-Voxels-Cache', writer ? `${writer.tier}-fill` : 'bypass')
      let received = 0
      for await (const chunk of upstream) {
        if (abort.signal.aborted) throw Error('Visitor disconnected')
        const buffer = Buffer.from(chunk)
        received += buffer.length
        if (writer) {
          try {
            await writer.write(buffer)
          } catch {
            await writer.abort()
            writer = null
          }
        }
        if (!res.write(buffer)) await once(res, 'drain', { signal: abort.signal })
      }
      if (received !== length) throw Error('Incomplete media response')
      if (writer) {
        await writer.finish().catch(() => {})
        writer = null
      }
      res.end()
    } catch (error) {
      if (!res.headersSent) res.status(502).json({ error: 'Media cache could not retrieve this source' })
      else res.destroy(error instanceof Error ? error : undefined)
    } finally {
      upstream?.destroy()
      await writer?.abort()
      if (claimed) {
        active--
        filling.delete(key)
      }
      res.off('close', close)
    }
  })
}
