import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { canonical } from '../common/federation/edit'

export type PresencePlayer = { uuid: string; position: number[]; orientation: [number, number, number, number]; animation: number }
export type PresencePacket = { key: string; payload: { world: string; node: string; at: number; players: PresencePlayer[] }; signature: string }
function exactKeys(value: object, keys: string[]) {
  return value && Object.keys(value).sort().join(',') === keys.sort().join(',')
}
export function validPlayer(player: PresencePlayer) {
  return (
    player &&
    exactKeys(player, ['uuid', 'position', 'orientation', 'animation']) &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(player.uuid) &&
    Array.isArray(player.position) &&
    player.position.length === 3 &&
    player.position.every((n) => Number.isFinite(n) && Math.abs(n) < 100000) &&
    Array.isArray(player.orientation) &&
    player.orientation.length === 4 &&
    player.orientation.every((n) => Number.isFinite(n) && Math.abs(n) <= 1.01) &&
    Number.isInteger(player.animation) &&
    player.animation >= 0 &&
    player.animation < 65536
  )
}
export function nodeIdentity(key: string) {
  return createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex')
}
export function signPresence(world: string, privateKey: string, players: PresencePlayer[], now = Date.now()): PresencePacket {
  const secret = createPrivateKey({ key: Buffer.from(privateKey, 'base64'), format: 'der', type: 'pkcs8' })
  const key = createPublicKey(secret).export({ format: 'der', type: 'spki' }).toString('base64')
  const payload = { world, node: nodeIdentity(key), at: now, players: players.filter(validPlayer).slice(0, 64) }
  return { key, payload, signature: sign(null, Buffer.from(canonical(payload)), secret).toString('base64') }
}
export function validPresence(packet: PresencePacket, world: string, now = Date.now()) {
  try {
    if (!exactKeys(packet, ['key', 'payload', 'signature'])) return false
    const p = packet.payload
    if (!exactKeys(p, ['world', 'node', 'at', 'players'])) return false
    if (
      packet.key.length > 100 ||
      packet.signature.length > 100 ||
      p.world !== world ||
      p.node !== nodeIdentity(packet.key) ||
      !Number.isSafeInteger(p.at) ||
      p.at < now - 15000 ||
      p.at > now + 5000 ||
      !Array.isArray(p.players) ||
      p.players.length > 64 ||
      !p.players.every(validPlayer)
    )
      return false
    const key = createPublicKey({ key: Buffer.from(packet.key, 'base64'), format: 'der', type: 'spki' })
    return key.asymmetricKeyType === 'ed25519' && verify(null, Buffer.from(canonical(p)), key, Buffer.from(packet.signature, 'base64'))
  } catch {
    return false
  }
}
export function remotePlayerId(node: string, uuid: string) {
  const hex = createHash('sha256').update(`${node}:${uuid}`).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = '8'
  const s = hex.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}
