import { createClient } from 'redis'
import cache from '../cache'
import { Db } from '../pg'
import { PassportStatic } from 'passport'
import { Express } from 'express'
import { AccessToken, WebhookReceiver, RoomServiceClient } from 'livekit-server-sdk'
import { orderLiveStrip } from '../../common/helpers/utils'

const success = true
const CHANNEL = 'live:updates'
const HASH = 'live:thumbnails'

function roomViewers(rooms: { name: string; numParticipants?: number }[], room: string): number {
  return rooms.find((r) => r.name === room)?.numParticipants ?? 0
}

export default async function LivekitController(db: Db, passport: PassportStatic, app: Express) {
  const svc = new RoomServiceClient('https://voxels-7pvk06qt.livekit.cloud', process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET)
  const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!)

  const emptyTimeout = 10 * 60
  const maxParticipants = 69

  let rooms = await svc.listRooms()

  async function refresh() {
    rooms = await svc.listRooms()
  }

  async function loadOrderedLiveEntries() {
    await refresh()
    if (!pub) return []
    const all = await pub.hGetAll(HASH)
    const entries = Object.values(all)
      .map((v) => {
        try {
          return JSON.parse(v)
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .map((entry: any) => ({
        ...entry,
        viewers: roomViewers(rooms, entry.room),
      }))
    return orderLiveStrip(entries)
  }

  function pushSnapshot() {
    loadOrderedLiveEntries()
      .then((entries) => {
        const line = `data: ${JSON.stringify({ type: 'snapshot', entries })}\n\n`
        sseClients.forEach((r) => {
          try {
            r.write(line)
          } catch {}
        })
      })
      .catch(console.error)
  }

  // SSE clients connected to this process
  const sseClients = new Set<any>()

  // Redis is optional - thumbnail/SSE features degrade gracefully if unavailable
  let pub: ReturnType<typeof createClient> | null = null

  ;(async () => {
    try {
      const client = createClient({ url: process.env.REDIS_URL })
      const sub = client.duplicate()
      await Promise.all([client.connect(), sub.connect()])
      pub = client

      sub.subscribe(CHANNEL, (msg) => {
        const line = `data: ${msg}\n\n`
        sseClients.forEach((r) => {
          try {
            r.write(line)
          } catch {}
        })
      })

      // Prune stale entries (broadcaster crashed without sending null)
      setInterval(async () => {
        const all = await client.hGetAll(HASH)
        const cutoff = Date.now() - 12000
        for (const [key, val] of Object.entries(all)) {
          try {
            const entry = JSON.parse(val)
            if (entry.ts < cutoff) {
              await client.hDel(HASH, key)
              client.publish(CHANNEL, JSON.stringify({ type: 'remove', parcel: key }))
            }
          } catch {}
        }
        // Re-rank strip every prune tick: fresh viewer counts + new random discovery slots.
        pushSnapshot()
      }, 10000)
    } catch (e) {
      console.error('LiveKit: Redis unavailable, thumbnail/SSE features disabled', e)
    }
  })()

  app.get('/api/rooms', (req, res) => {
    res.json({ success, rooms })
  })

  app.get('/api/rooms/:name', async (req, res) => {
    const name = req.params.name.toString()
    if (!name.match(/^[a-z0-9-]{1,32}$/)) {
      res.status(400).send({ error: 'Invalid room name' })
      return
    }
    const room = rooms.find((r) => r.name === name)
    if (!room) {
      res.status(404).send({ error: 'Room not found' })
      return
    }
    res.json({ success, room })
  })

  app.get('/api/rooms/:name/token', cache(false), async (req, res) => {
    const wallet = req.user ? (req.user as Express.User & { wallet: string }).wallet : `anon-${Math.random().toString(36).slice(2)}`

    const name = req.params.name.toString()
    if (!name.match(/^[a-z0-9-]{1,32}$/)) {
      res.status(400).send({ error: 'Invalid room name' })
      return
    }

    let room = rooms.find((r) => r.name === name)
    if (!room) {
      room = await svc.createRoom({ name, emptyTimeout, maxParticipants })
      refresh()
    }

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: wallet })
    at.addGrant({ roomJoin: true, room: name, canPublish: true, canSubscribe: true })
    res.json({ success, room, token: at.toJwt() })
  })

  app.post('/api/rooms/:name/thumbnail', async (req, res) => {
    if (!pub) {
      res.json({ success })
      return
    }
    const name = req.params.name.toString()
    const { avatar, parcel, coord, thumbnail } = req.body ?? {}

    if (thumbnail === null || thumbnail === undefined) {
      await pub.hDel(HASH, name)
      pub.publish(CHANNEL, JSON.stringify({ type: 'remove', parcel: name }))
    } else {
      await refresh()
      const viewers = roomViewers(rooms, name)
      const entry = { room: name, parcel, coord, avatar, thumbnail, ts: Date.now(), viewers }
      await pub.hSet(HASH, name, JSON.stringify(entry))
      pub.publish(CHANNEL, JSON.stringify({ type: 'update', room: name, parcel, coord, avatar, thumbnail, viewers, ts: entry.ts }))
    }

    res.json({ success })
  })

  app.get('/api/live', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    if (pub) {
      const entries = await loadOrderedLiveEntries()
      res.write(`data: ${JSON.stringify({ type: 'snapshot', entries })}\n\n`)
    } else {
      res.write(`data: ${JSON.stringify({ type: 'snapshot', entries: [] })}\n\n`)
    }

    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
  })
}
