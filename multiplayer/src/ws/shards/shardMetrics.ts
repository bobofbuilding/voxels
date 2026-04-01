import { ShardId } from '../../common/shardId'
import { CustomMetrics } from '../../createMetrics'

export type ShardMetrics = {
  logWorldStateBroadcastStarted(): void
  logBroadcastDuration(metadata: { type: string; durationMs: number }): void
  logMessageReceived(metadata: { type: string | undefined; status: 'ok' | 'error'; length: number }): void
  logMessageTransferred(metadata: {
    type: string | undefined
    status: 'ok' | 'error'
    length: number
    durationMs: number
  }): void
  logOutboundMessageDropped(metadata: { type: string | undefined }): void
  logInactiveClient(): void
  logClientMsgRatelimited(): void
}

export function createShardMetrics(metrics: CustomMetrics, shardType: ShardId['type']): ShardMetrics {
  return {
    logWorldStateBroadcastStarted: () => metrics.websocket_broadcast_world_state_started_total.inc({ shardType }),
    logBroadcastDuration: ({ type, durationMs }) =>
      metrics.websocket_broadcast_duration.observe({ type, shardType }, durationMs),
    logMessageReceived: ({ type, status, length }) => {
      metrics.websocket_receive_messages_total.inc({ type, status, shardType })
      metrics.websocket_receive_bytes_total.inc({ type, status, shardType }, length)
    },
    logMessageTransferred: ({ type, status, length, durationMs }) => {
      metrics.websocket_transmit_messages_total.inc({ status, type, shardType })
      metrics.websocket_transmit_bytes_total.inc({ status, type, shardType }, length)
      metrics.websocket_transmit_duration_total.inc({ status, type, shardType }, durationMs)
    },
    logInactiveClient: () => metrics.websocket_inactive_total.inc({}),
    logClientMsgRatelimited: () => metrics.websocket_message_ratelimited_total.inc({}),
    logOutboundMessageDropped: ({ type }) => metrics.websocket_transmit_messages_dropped_total.inc({ type }),
  }
}
