// 512 bit bloom of `${id}:${hash}` keys, used to batch parcel fetches into one cacheable url
const BITS = 512
const K = 7

// murmur3 finalizer. raw fnv with two seeds is useless here: every key is the same length, so they differ by a constant
function mix(h: number) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

function bloomBits(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  // mix every probe separately, a + i*b mod 512 only has ~17 bits of pattern and collides
  const out: number[] = []
  for (let i = 0; i < K; i++) out.push(mix(h + Math.imul(i, 0x9e3779b9)) % BITS)
  return out
}

export function packIds(keys: string[]) {
  const bits = new Uint8Array(BITS / 8)
  for (const key of keys) for (const n of bloomBits(key)) bits[n >> 3] |= 1 << (n & 7)
  return btoa(String.fromCharCode(...bits))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// null if the pack isn't a valid filter
export function unpackIds(pack: string): ((key: string) => boolean) | null {
  let raw: string
  try {
    raw = atob(pack.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return null
  }
  if (raw.length !== BITS / 8) return null
  const bits = Uint8Array.from(raw, (c) => c.charCodeAt(0))
  return (key) => bloomBits(key).every((n) => bits[n >> 3] & (1 << (n & 7)))
}
