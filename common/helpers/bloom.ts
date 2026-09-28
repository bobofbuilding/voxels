// 256 bit bloom of `${id}:${hash}` keys, used to batch parcel fetches into one cacheable url
const BITS = 256
const K = 5

function fnv(key: string, seed: number) {
  let h = seed
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function bloomBits(key: string) {
  const a = fnv(key, 2166136261)
  const b = fnv(key, 3323198485) | 1
  const out: number[] = []
  for (let i = 0; i < K; i++) out.push(((a + i * b) >>> 0) % BITS)
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
