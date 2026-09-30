import { MessageType } from '../../common/messages'
import { remotePlayerId, signPresence, validPresence, type PresencePacket } from '../../services/federation-presence'
import type { Shards } from './ws/shards/shards'
import type { createClient } from 'redis'

export function startFederatedPresence(redis: ReturnType<typeof createClient>, shards: Shards, signal: AbortSignal) {
  const world = process.env.FEDERATION_WORLD,
    key = process.env.FEDERATION_PRIVATE_KEY
  if (!world || !key) return
  const previous = new Set<string>()
  let busy = false
  const update = async () => {
    if (busy) return
    busy = true
    try {
      const players = Array.from(shards.worldShard.getClientList())
        .filter((p) => p.loggedIn)
        .map((p) => p.updateAvatarMessage())
        .filter(Boolean) as any[]
      const packet = signPresence(
        world,
        key,
        players.map((p) => ({
          uuid: p.uuid,
          position: p.position,
          orientation: p.orientation,
          animation: p.animation,
        })),
      )
      await redis.set('federation:presence:local', JSON.stringify(packet), { EX: 15 })
      const remote = JSON.parse((await redis.get('federation:presence:remote')) || '[]') as PresencePacket[]
      const current = new Set<string>()
      for (const snapshot of remote.slice(0, 16)) {
        if (!validPresence(snapshot, world) || snapshot.payload.node === packet.payload.node) continue
        for (const player of snapshot.payload.players) {
          const uuid = remotePlayerId(snapshot.payload.node, player.uuid)
          current.add(uuid)
          shards.worldShard.remoteAvatars.set(uuid, {
            type: MessageType.updateAvatar,
            uuid,
            position: player.position,
            orientation: player.orientation,
            animation: player.animation,
          })
          // Do not forward unverifiable wallet/name claims from permissionless hosts.
          // New joiners receive these entries in the shard join snapshot.
          if (!previous.has(uuid))
            shards.worldShard.broadcastFromServer({
              type: MessageType.createAvatar,
              uuid,
              description: { name: 'Remote traveler' },
            })
          shards.worldShard.broadcastFromServer({
            type: MessageType.worldState,
            avatars: [
              {
                type: MessageType.updateAvatar,
                uuid,
                position: player.position,
                orientation: player.orientation,
                animation: player.animation,
              },
            ],
          })
        }
      }
      for (const uuid of previous)
        if (!current.has(uuid)) {
          shards.worldShard.remoteAvatars.delete(uuid)
          shards.worldShard.broadcastFromServer({ type: MessageType.destroyAvatar, uuid })
        }
      previous.clear()
      for (const uuid of current) previous.add(uuid)
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => void update().catch((e) => console.warn('Presence sync:', e.message)), 1000)
  signal.addEventListener('abort', () => clearInterval(timer), { once: true })
}
