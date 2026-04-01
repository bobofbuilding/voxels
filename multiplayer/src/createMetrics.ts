import { as, count, sum } from 'ix/iterable'
import { map } from 'ix/iterable/operators'
import { Counter, Gauge, Histogram, Registry as PromRegistry, Summary } from 'prom-client'
import { createPromRegistry } from './common/metrics'
import { Client } from './ws/client'

type MetricsOptions = {
  appName: string
  appVersion: string
  instanceId: string
  clientAccessor: () => Iterable<Readonly<Client>>
  worldClientCount: () => number
  spaceClientCount: () => number
}

const shardLabels = ['shardType'] as const
const messageLabels = ['status', 'type', ...shardLabels] as const
const clusterMesageLabels = ['messageType', 'type', ...shardLabels] as const
const broadcastLabels = ['type', ...shardLabels] as const
const redisMessageLabels = ['channel'] as const

export type ShardLabels = (typeof shardLabels)[number]
export type MessageLabel = (typeof messageLabels)[number]
export type BroadcastLabel = (typeof broadcastLabels)[number]
export type RedisMessageLabel = (typeof redisMessageLabels)[number]
export type ClusterMessageLabel = (typeof clusterMesageLabels)[number]

export type CustomMetrics = {
  websocket_receive_messages_total: Counter<MessageLabel>
  websocket_receive_bytes_total: Counter<MessageLabel>
  websocket_transmit_messages_total: Counter<MessageLabel>
  websocket_transmit_bytes_total: Counter<MessageLabel>
  websocket_transmit_duration_total: Counter<MessageLabel>
  websocket_transmit_messages_dropped_total: Counter<MessageLabel>
  websocket_broadcast_duration: Summary<BroadcastLabel>
  websocket_broadcast_world_state_started_total: Counter<ShardLabels>
  websocket_inactive_total: Counter<never>
  websocket_message_ratelimited_total: Counter<never>
  websocket_backpressure_total: Gauge<never>
  websocket_unauthorized_total: Counter<never>
  websocket_client_total: Gauge<never>
  websocket_client_age_seconds: Histogram<never>
  websocket_users_loggedin_total: Gauge<never>
  websocket_connection_received: Counter<never>
  websocket_connection_rejected: Counter<never>
  websocket_connection_accepted: Counter<never>
  websocket_connected_clients: Gauge<ShardLabels>

  app_info: Gauge<never>
}

export type Metrics = {
  registry: PromRegistry
  customMetrics: CustomMetrics
}

export default function createMetrics({
  appName,
  appVersion,
  instanceId,
  clientAccessor,
  spaceClientCount,
  worldClientCount,
}: MetricsOptions): Metrics {
  const registry = createPromRegistry(appName, instanceId)

  return {
    registry,
    customMetrics: {
      websocket_receive_messages_total: new Counter({
        name: 'websocket_receive_messages_total',
        help: 'number of messages received',
        labelNames: messageLabels,
        registers: [registry],
      }),
      websocket_receive_bytes_total: new Counter({
        name: 'websocket_receive_bytes_total',
        help: 'the byte size of messages received',
        labelNames: messageLabels,
        registers: [registry],
      }),
      websocket_transmit_messages_total: new Counter({
        name: 'websocket_transmit_messages_total',
        help: 'number of messages transmitted',
        labelNames: messageLabels,
        registers: [registry],
      }),
      websocket_transmit_bytes_total: new Counter({
        name: 'websocket_transmit_bytes_total',
        help: 'the byte size of messages transmitted',
        labelNames: messageLabels,
        registers: [registry],
      }),
      websocket_transmit_duration_total: new Counter({
        name: 'websocket_transmit_duration_total',
        help: 'the aggregate duration transmitting messages',
        labelNames: messageLabels,
        registers: [registry],
      }),
      websocket_transmit_messages_dropped_total: new Counter({
        name: 'websocket_transmit_messages_dropped_total',
        help: 'number of outbound messages dropped',
        labelNames: messageLabels,
        registers: [registry],
      }),
      websocket_broadcast_duration: new Summary({
        name: 'websocket_broadcast_duration',
        help: 'the duration for a broadcast to complete (first send start => last send end)',
        labelNames: broadcastLabels,
        registers: [registry],
      }),
      websocket_broadcast_world_state_started_total: new Counter({
        name: 'websocket_broadcast_world_state_started_total',
        help: 'the number of broadcasts, as counted from start time',
        labelNames: shardLabels,
        registers: [registry],
      }),
      websocket_inactive_total: new Counter({
        name: 'websocket_inactive_total',
        help: 'the number of sockets kicked due to inactivity',
        registers: [registry],
      }),
      websocket_connection_received: new Counter({
        name: 'websocket_connection_received',
        help: 'the number of socket connections received',
        registers: [registry],
      }),
      websocket_connection_rejected: new Counter({
        name: 'websocket_connection_rejected',
        help: 'the number of socket connections rejected',
        registers: [registry],
      }),
      websocket_connection_accepted: new Counter({
        name: 'websocket_connection_accepted',
        help: 'the number of socket connections accepted',
        registers: [registry],
      }),
      websocket_message_ratelimited_total: new Counter({
        name: 'websocket_message_ratelimited_total',
        help: 'the number of sockets kicked due to triggering message ratelimits',
        registers: [registry],
      }),
      websocket_backpressure_total: new Gauge({
        name: 'websocket_backpressure_total',
        help: 'the total amount of buffered bytes in the websockets',
        collect() {
          this.set(sum(as(clientAccessor()).pipe(map((c) => c.backpressure))))
        },
        registers: [registry],
      }),
      websocket_unauthorized_total: new Counter({
        name: 'websocket_unauthorized_total',
        help: 'the number of sockets banned due to failed JWT token ',
        registers: [registry],
      }),
      websocket_client_total: new Gauge({
        name: 'websocket_client_total',
        help: 'the number of currently connected users (open websockets)',
        collect() {
          this.set(count(clientAccessor()))
        },
        registers: [registry],
      }),
      websocket_client_age_seconds: new Histogram({
        name: 'websocket_client_age_seconds',
        help: 'the time clients has been connected',
        buckets: [60, 60 * 5, 60 * 15, 60 * 30, 60 * 60, 60 * 60 * 3, 60 * 60 * 6, 60 * 60 * 12, 60 * 60 * 24],
        collect() {
          this.reset()
          for (const client of clientAccessor()) {
            this.observe(client.ageInSec)
          }
        },
        registers: [registry],
      }),
      websocket_users_loggedin_total: new Gauge({
        name: 'websocket_users_loggedin_total',
        help: 'the number of current connected logged in users (# of wallets, disregarding multiple tabs)',
        collect() {
          const uniqueWallets = new Set<string>()
          for (const client of clientAccessor()) {
            if (client.state?.identity?.wallet) {
              uniqueWallets.add(client.state.identity.wallet)
            }
          }
          this.set(uniqueWallets.size)
        },
        registers: [registry],
      }),

      websocket_connected_clients: new Gauge({
        name: 'websocket_connected_clients',
        help: 'the number of current connected clients in world and in spaces',
        collect() {
          this.set({ shardType: 'world' }, worldClientCount())
          this.set({ shardType: 'space' }, spaceClientCount())
        },
        registers: [registry],
        labelNames: shardLabels,
      }),

      app_info: new Gauge({
        name: 'app_info',
        help: 'information about this app for easier annotations in dashboards',
        collect() {
          this.set({ version: appVersion }, 1)
        },
        labelNames: ['version'] as const,
        registers: [registry],
      }),
    },
  }
}
