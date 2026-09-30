import { createClient } from 'redis'
import { validPresence, type PresencePacket } from '../../services/federation-presence'
import express, { Express } from 'express'
import rateLimit from 'express-rate-limit'
import db from '../pg'
import { acceptEdit, baseAndClock, federationWorld, initializeFederation } from './store'

export function installFederation(app: Express) {
  if (!federationWorld) return
  if (process.env.PARCEL_EDIT_POLICY !== 'admin') throw Error('Federation currently requires the shared admin-wallet editing policy')
  const ready = initializeFederation().then(() => db.query('federation/cursors', 'CREATE TABLE IF NOT EXISTS federation_cursors(peer text PRIMARY KEY, seq bigint NOT NULL)'))
  const presence = new Map<string, PresencePacket>()
  const redis = createClient({ url: process.env.REDIS_URL })
  redis.on('error', (error) => console.warn('Federation presence cache:', error.message))
  const redisReady = redis.connect()
  const router = express.Router()
  router.use(rateLimit({ windowMs: 60000, max: 300, standardHeaders: true, legacyHeaders: false }), express.json({ limit: '2mb' }))
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  const handle = (fn: Function) => async (req: any, res: any) => {
    try {
      await ready
      await fn(req, res)
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Synchronization failed' })
    }
  }
  const keepPresence = (packet: PresencePacket) => {
    if (!validPresence(packet, federationWorld) || packet.payload.node === process.env.FEDERATION_NODE) return
    for (const [node, value] of presence) if (!validPresence(value, federationWorld)) presence.delete(node)
    if (packet.payload.at > (presence.get(packet.payload.node)?.payload.at || 0) && (presence.has(packet.payload.node) || presence.size < 16)) presence.set(packet.payload.node, packet)
  }
  router.post(
    '/presence',
    handle(async (req: any, res: any) => {
      if (!Array.isArray(req.body.snapshots) || req.body.snapshots.length > 16) throw Error('Invalid presence envelope')
      await redisReady
      for (const packet of req.body.snapshots) keepPresence(packet)
      await redis.set('federation:presence:remote', JSON.stringify([...presence.values()]), { EX: 15 })
      res.json({ ok: true })
    }),
  )
  router.post(
    '/batch',
    handle(async (req: any, res: any) => {
      if (!Array.isArray(req.body.events) || req.body.events.length > 16) throw Error('Invalid edit batch')
      const ids = []
      for (const event of req.body.events) ids.push(await acceptEdit(event))
      res.json({ ids })
    }),
  )
  router.get(
    '/presence',
    handle(async (_req: any, res: any) => {
      await redisReady
      for (const [node, packet] of presence) if (!validPresence(packet, federationWorld)) presence.delete(node)
      const local = await redis.get('federation:presence:local')
      const snapshots = [...presence.values()]
      if (local) {
        const packet = JSON.parse(local)
        if (validPresence(packet, federationWorld)) snapshots.push(packet)
      }
      res.json({ world: federationWorld, snapshots: snapshots.slice(-16) })
    }),
  )
  router.get(
    '/info',
    handle((_req: any, res: any) => res.json({ version: 1, world: federationWorld, editor: process.env.OWNER_ADDRESS, policy: 'wallet-signed-public-builds', node: process.env.FEDERATION_NODE })),
  )
  router.get(
    '/parcel/:id',
    handle(async (req: any, res: any) => {
      const parcel = Number(req.params.id)
      if (!Number.isSafeInteger(parcel) || parcel < 1) throw Error('Invalid parcel')
      res.json(await baseAndClock(parcel))
    }),
  )
  router.post(
    '/edits',
    handle(async (req: any, res: any) => res.json({ id: await acceptEdit(req.body) })),
  )
  router.get(
    '/events',
    handle(async (req: any, res: any) => {
      const after = Number(req.query.after || 0)
      if (!Number.isSafeInteger(after) || after < 0) throw Error('Invalid cursor')
      const result = await db.query('federation/feed', 'SELECT e.seq::text,e.event FROM federation_edits e JOIN properties p ON p.id=e.parcel WHERE e.seq>$1 AND p.visible ORDER BY e.seq LIMIT 16', [after])
      const rows = []
      let bytes = 0
      for (const row of result.rows) {
        const size = Buffer.byteLength(JSON.stringify(row))
        if (rows.length && bytes + size > 2_000_000) break
        rows.push(row)
        bytes += size
      }
      res.json({ world: federationWorld, events: rows, next: rows.length ? Number(rows[rows.length - 1].seq) : after })
    }),
  )
  app.use('/federation', router)
  const peers = String(process.env.FEDERATION_PEERS || '')
    .split(',')
    .filter(Boolean)
    .map((value) => {
      const url = new URL(value)
      if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) throw Error('Peer must be an HTTP(S) origin')
      if (url.protocol === 'http:' && process.env.FEDERATION_ALLOW_LOCAL_HTTP !== 'true') throw Error('Peers require HTTPS outside isolated local tests')
      return url.origin
    })
  if (peers.length > 16) throw Error('At most 16 configured peers per node')
  let busy = false
  const synchronize = async () => {
    if (busy) return
    busy = true
    try {
      await ready
      await redisReady
      await Promise.all(
        peers.map(async (peer) => {
          try {
            const localPresence = await redis.get('federation:presence:local')
            const snapshots = [...presence.values()].filter((p) => validPresence(p, federationWorld)).slice(0, 15)
            if (localPresence) snapshots.push(JSON.parse(localPresence))
            if (snapshots.length) {
              const sentPresence = await fetch(`${peer}/federation/presence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshots }), signal: AbortSignal.timeout(3000), redirect: 'error' })
              await sentPresence.body?.cancel()
            }
            const presenceResponse = await fetch(`${peer}/federation/presence`, { signal: AbortSignal.timeout(3000), redirect: 'error' })
            if (presenceResponse.ok && presenceResponse.body) {
              const chunks: Uint8Array[] = []
              let size = 0
              for await (const chunk of presenceResponse.body as any) {
                size += chunk.length
                if (size > 300000) throw Error('Presence feed exceeds limit')
                chunks.push(chunk)
              }
              const data = JSON.parse(Buffer.concat(chunks).toString())
              if (data.world === federationWorld && Array.isArray(data.snapshots))
                for (const packet of data.snapshots.slice(0, 16)) {
                  if (!validPresence(packet, federationWorld) || packet.payload.node === process.env.FEDERATION_NODE) continue
                  keepPresence(packet)
                }
            }
            await presenceResponse.body?.cancel().catch(() => {})
            await redis.set('federation:presence:remote', JSON.stringify([...presence.values()]), { EX: 15 })
            const cursor = await db.query('federation/cursor', 'SELECT seq::text FROM federation_cursors WHERE peer=$1', [peer])
            const after = Number(cursor.rows[0]?.seq || 0)
            const response = await fetch(`${peer}/federation/events?after=${after}`, { signal: AbortSignal.timeout(5000), redirect: 'error' })
            if (!response.ok || !response.body) {
              await response.body?.cancel()
              throw Error('Peer unavailable')
            }
            const chunks: Uint8Array[] = []
            let bytes = 0
            for await (const chunk of response.body as any) {
              bytes += chunk.length
              if (bytes > 3_000_000) {
                await response.body.cancel().catch(() => {})
                throw Error('Peer response exceeds limit')
              }
              chunks.push(chunk)
            }
            const feed = JSON.parse(Buffer.concat(chunks).toString())
            if (feed.world !== federationWorld || !Array.isArray(feed.events) || feed.events.length > 16 || !Number.isSafeInteger(feed.next) || feed.next < after) throw Error('Invalid peer feed')
            let last = after
            for (const row of feed.events) {
              const seq = Number(row.seq)
              if (!Number.isSafeInteger(seq) || seq <= last) throw Error('Invalid event sequence')
              await acceptEdit(row.event)
              last = seq
            }
            if (feed.next !== last) throw Error('Invalid peer cursor')
            await db.query('federation/checkpoint', 'INSERT INTO federation_cursors VALUES($1,$2) ON CONFLICT(peer) DO UPDATE SET seq=excluded.seq', [peer, last])
            const sent = await db.query('federation/sent', 'SELECT seq::text FROM federation_cursors WHERE peer=$1', [peer + '#out'])
            const outgoing = await db.query('federation/outgoing', 'SELECT e.seq::text,e.event FROM federation_edits e JOIN properties p ON p.id=e.parcel WHERE p.visible AND e.seq>$1 ORDER BY e.seq LIMIT 1', [sent.rows[0]?.seq || 0])
            if (outgoing.rows.length) {
              const response = await fetch(`${peer}/federation/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: outgoing.rows.map((row) => row.event) }),
                signal: AbortSignal.timeout(5000),
                redirect: 'error',
              })
              await response.body?.cancel()
              if (!response.ok) throw Error('Peer refused outgoing edit')
              await db.query('federation/sent-checkpoint', 'INSERT INTO federation_cursors VALUES($1,$2) ON CONFLICT(peer) DO UPDATE SET seq=excluded.seq', [peer + '#out', outgoing.rows[0].seq])
            }
          } catch (e) {
            console.warn(`Federation peer ${peer}: ${e instanceof Error ? e.message : 'sync failed'}`)
          }
        }),
      )
      for (const [node, packet] of presence) if (!validPresence(packet, federationWorld)) presence.delete(node)
      await redis.set('federation:presence:remote', JSON.stringify([...presence.values()]), { EX: 15 })
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => void synchronize().catch(console.error), 2000)
  timer.unref()
  void synchronize().catch(console.error)
}
