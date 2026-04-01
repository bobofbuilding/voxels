import { concat } from 'ix/iterable'
import { flatMap } from 'ix/iterable/operators'
import createWWWServer from './api'
import { InMemoryGlobalClientStateStore } from './common/clientStateStore'
import { InMemoryChatStore } from './common/inMemChatStore'
import { createConnection } from './common/pq'
import { APP_NAME } from './constants/appName'
import { createLogger } from './createLogger'
import createMetrics from './createMetrics'
import createServer from './createServer'
import createWebsocketServer from './ws'
import { Client } from './ws/client'
import createShards from './ws/shards/shards'

const HEALTHCHECK_INTERVAL_MS = 10_000
const UNHEALTHY_TIMEOUT_MS = 30_000

const instanceId = globalThis.crypto.randomUUID()

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv')
// Load .env file if it exists, but don't fail if it doesn't
const result = dotenv.config()
if (result.error && result.error.code !== 'ENOENT') {
  // Only throw if there's an error other than file not found
  throw result.error
}
// If file not found, we'll just use environment variables directly

const logger = createLogger(process.env.APP_NAME)

const shutdownSignaller = new AbortController()
process.once('SIGINT', () => {
  logger.info('Received SIGINT, shutting down')
  shutdownSignaller.abort('ABORT:SIGINT received')

  // if we receive SIGINT again, exit immediately
  process.once('SIGINT', () => process.exit(0))
})

function ensureEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Environment variable '${name}' is required`)
  return value
}

async function start(signal: AbortSignal) {
  logger.debug('starting server')

  const jwtSecret = ensureEnv('JWT_SECRET')

  const connection = createConnection(APP_NAME)
  const globalStateStore = new InMemoryGlobalClientStateStore(logger)
  const chatStore = new InMemoryChatStore(30 * 60 * 1000)

  let clientAccessor: (() => Iterable<Readonly<Client>>) | null = null
  const worldClientCount: (() => number) | null = () => globalStateStore.getWorldCount()
  const spaceClientCount: (() => number) | null = () => globalStateStore.getSpaceCount()

  const metrics = createMetrics({
    appName: APP_NAME,
    appVersion: process.env.VERSION || 'unknown',
    instanceId,
    clientAccessor: () => (clientAccessor === null ? [] : clientAccessor()),
    worldClientCount,
    spaceClientCount,
  })

  // todo more healthchecks!

  const server = createServer(logger)

  const shards = await createShards(
    (topic, message, isBinary) => server.publish(topic, message, isBinary),
    logger,
    globalStateStore,
    connection,
    chatStore,
    metrics.customMetrics,
    jwtSecret,
  )

  clientAccessor = () => concat([shards.worldShard], shards.spaceShards.values()).pipe(flatMap((s) => s.getClients()))

  createWWWServer(server.server, logger, globalStateStore, chatStore, shards, metrics)
  createWebsocketServer(server, server.server, logger, shards)

  signal.addEventListener('abort', () => {
    // ensure we exit if the server does not close in time
    setTimeout(() => {
      console.warn('Server did not shutdown gracefully in time, forcing shutdown')
      process.exit(0)
    }, 5000)
    try {
      logger.debug('HTTP server closing...')
      server.server.close(() => {
        logger.debug('HTTP server closed')
        process.exit(0)
      })
    } catch (err) {
      logger.error('Error closing HTTP server', err)
      process.exit(0)
    }
  })

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3780
  server.server.listen(port, () => {
    logger.info('Listening on port ' + port)
  })
}

// let's go! 🚀🚀🚀
start(shutdownSignaller.signal)
