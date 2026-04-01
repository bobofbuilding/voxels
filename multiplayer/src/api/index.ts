import type http from 'http'
import type winston from 'winston'
import { ChatStore } from '../common/chatStore'
import { ClientState } from '../common/clientState'
import { GlobalClientStateStore } from '../common/clientStateStore'
import { ClientUUID } from '../common/clientUUID'
import { SpaceId } from '../common/spaceId'
import { APP_NAME } from '../constants/appName'
import { Metrics } from '../createMetrics'
import { Shards } from '../ws/shards/shards'
import checkCors from './checkCors'
import { createMetricsHandler } from './metrics'

type AvatarResource = {
  id: ClientUUID
  name: string | null
  wallet?: string
  description: {
    animation: number
    position: [number, number, number]
    orientation: [number, number, number, number]
  } | null
}

export const tryMapAvatarResourceFromClientState = (c: ClientState): AvatarResource | null =>
  c.avatar === null
    ? null
    : {
        id: c.clientUUID,
        name: c.identity?.name,
        wallet: c.identity?.wallet,
        description: {
          animation: c.avatar.animation,
          position: c.avatar.position,
          orientation: c.avatar.orientation,
        },
      }

type UserResource = {
  name: string | null
  wallet?: string
  animation: number | null
  position: [number, number, number] | null
  lastSeen: number | null
  space?: SpaceId
}

export const mapUserResourceFromClientState = (c: ClientState, space?: SpaceId): UserResource => ({
  lastSeen: c.lastSeen,
  name: c.identity?.name,
  wallet: c.identity?.wallet,
  animation: c.avatar !== null ? c.avatar.animation : null,
  position: c.avatar !== null ? c.avatar.position : null,
  space,
})

const NOT_FOUND = '404 Not Found'
// why create an object, to json stringify it when we can just raw dog some json?
const UNSUCCESFUL_RESPONSE = '{"success":false}'

/**
 * Constructs the WebSocket URL for clients to connect to
 * Uses MULTIPLAYER_HOST environment variable and ensures it has the correct format
 * for the WebSocket connection (adding /socket and converting http to ws)
 */
function constructSocketUrl(): string {
  console.log('Environment variables for socket URL:', {
    SOCKET_URL: process.env.SOCKET_URL,
    MULTIPLAYER_HOST: process.env.MULTIPLAYER_HOST,
    PUBLIC_URL: process.env.PUBLIC_URL,
  })

  // If SOCKET_URL is explicitly set (for backward compatibility), use it
  if (process.env.SOCKET_URL) {
    console.log('Using SOCKET_URL:', process.env.SOCKET_URL)
    return process.env.SOCKET_URL
  }

  // Use MULTIPLAYER_HOST to construct WebSocket URL
  if (process.env.MULTIPLAYER_HOST) {
    try {
      console.log('Constructing from MULTIPLAYER_HOST:', process.env.MULTIPLAYER_HOST)
      const url = new URL(process.env.MULTIPLAYER_HOST)

      // Convert http/https to ws/wss if needed
      if (url.protocol.startsWith('http')) {
        url.protocol = url.protocol.replace('http', 'ws')
      }

      // Add /socket to the path
      const originalPath = url.pathname
      if (!originalPath.endsWith('/socket')) {
        // Make sure we have a trailing slash before adding 'socket'
        const newPath = originalPath.endsWith('/') ? originalPath + 'socket' : originalPath + '/socket'
        url.pathname = newPath
      }

      const finalUrl = url.toString()
      console.log('Generated WebSocket URL:', finalUrl)
      return finalUrl
    } catch (e) {
      console.error('Failed to parse MULTIPLAYER_HOST:', process.env.MULTIPLAYER_HOST, e)
    }
  }

  // Fall back to relative path if neither is available
  console.log('Falling back to default path')
  const fallbackUrl = 'wss://' + (process.env.PUBLIC_URL || '') + '/socket'
  console.log('Fallback URL:', fallbackUrl)
  return fallbackUrl
}

export default function createWWWServer(
  server: http.Server,
  logger: winston.Logger,
  globalStateStore: GlobalClientStateStore,
  chatStore: ChatStore,
  shards: Shards,
  metrics: Metrics,
) {
  const clientCount = () => {
    return globalStateStore.getWorldCount() + globalStateStore.getSpaceCount()
  }

  const getWorldClients = () => {
    return shards.worldShard.getClientsStateIterator()
  }

  const metricsHandler = createMetricsHandler(metrics)

  server.on('request', async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    const pathname = url.pathname
    const method = req.method || 'GET'

    // CORS preflight
    if (method === 'OPTIONS') {
      const ok = checkCors(req, res)
      if (!ok) return
      res.statusCode = 204
      res.end()
      return
    }

    if (pathname === '/ping' && method === 'GET') {
      res.statusCode = 200
      res.end('pong')
      return
    }

    if (pathname === '/metrics' && method === 'GET') {
      await metricsHandler(req, res)
      return
    }

    if (pathname === '/' && method === 'GET') {
      const responseBody = {
        name: APP_NAME,
        version: process.env.VERSION,
        clients: clientCount(),
        links: { multiplayerSocket: constructSocketUrl() },
      }
      res.statusCode = 200
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=10')
      res.end(JSON.stringify(responseBody))
      return
    }

    if (pathname === '/socket/info' && method === 'GET') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ name: APP_NAME, version: process.env.VERSION }))
      return
    }

    // api:
    if (pathname === '/api/users.json' && method === 'GET') {
      const ok = checkCors(req, res)
      if (!ok) return
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=30')
      res.write('{"users":[')
      let i = 0
      for (const c of getWorldClients()) {
        if (i !== 0) res.write(',')
        res.write(JSON.stringify(mapUserResourceFromClientState(c)))
        i++
      }
      res.write(']}')
      res.end()
      return
    }

    const userWalletMatch = pathname.match(/^\/api\/user\/([^/]+)\.json$/)
    if (userWalletMatch && method === 'GET') {
      const wallet = decodeURIComponent(userWalletMatch[1]!)
      const client = globalStateStore.getStore('world').getByWallet(wallet)
      if (!client) {
        logger.debug('User not found', wallet)
        res.statusCode = 404
        res.end(UNSUCCESFUL_RESPONSE)
        return
      }
      const ok = checkCors(req, res)
      if (!ok) return
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=5')
      res.end(JSON.stringify(mapUserResourceFromClientState(client)))
      return
    }

    if (pathname === '/api/avatars.json' && method === 'GET') {
      const ok = checkCors(req, res)
      if (!ok) return
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=4, stale-while-revalidate=5')
      res.write('{"avatars":[')
      let i = 0
      for (const c of getWorldClients()) {
        const avatar = tryMapAvatarResourceFromClientState(c)
        if (avatar === null) continue
        if (i !== 0) res.write(',')
        res.write(JSON.stringify(avatar))
        i++
      }
      res.write(']}')
      res.end()
      return
    }

    const avatarMatch = pathname.match(/^\/api\/avatar\/([^/]+)\.json$/)
    if (avatarMatch && method === 'GET') {
      const uuid = ClientUUID.tryParse(decodeURIComponent(avatarMatch[1]!))
      if (!uuid) {
        res.statusCode = 404
        res.end(UNSUCCESFUL_RESPONSE)
        return
      }
      const client = globalStateStore.getStore('world').get(uuid)
      if (!client) {
        res.statusCode = 404
        res.end(UNSUCCESFUL_RESPONSE)
        return
      }
      const ok = checkCors(req, res)
      if (!ok) return
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: true, user: mapUserResourceFromClientState(client) }))
      return
    }

    if (pathname === '/api/active-parcels.json' && method === 'GET') {
      const activeParcels: Record<number, number> = {}
      for (const c of getWorldClients()) {
        const parcel = c.lastSeen
        if (parcel) activeParcels[parcel] = (activeParcels[parcel] ?? 0) + 1
      }
      const ok = checkCors(req, res)
      if (!ok) return
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30')
      res.end(JSON.stringify({ activeParcels }))
      return
    }

    const parcelsMatch = pathname.match(/^\/api\/parcels\/(\d+)\.json$/)
    if (parcelsMatch && method === 'GET') {
      const parcel = parseInt(parcelsMatch[1]!, 10)
      if (isNaN(parcel)) {
        res.statusCode = 404
        res.end(UNSUCCESFUL_RESPONSE)
        return
      }
      const ok = checkCors(req, res)
      if (!ok) return
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=30')
      res.write('{"users":[')
      let i = 0
      for (const client of getWorldClients()) {
        if (client.lastSeen === parcel) {
          if (i !== 0) res.write(',')
          res.write(JSON.stringify(mapUserResourceFromClientState(client)))
          i++
        }
      }
      res.write(']}')
      res.end()
      return
    }

    if (pathname === '/api/chat.json' && method === 'GET') {
      const ok = checkCors(req, res)
      if (!ok) return
      const messages = await chatStore.get(100)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=10')
      res.end(JSON.stringify({ messages }))
      return
    }

    // fallthrough
    res.statusCode = 404
    res.end(NOT_FOUND)
  })
}
