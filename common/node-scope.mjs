// Coverage selects storage and replication, never wallet authority.
export function nodeScope(mode = 'full', value = '') {
  if (!['full', 'partial'].includes(mode)) throw Error('Node mode must be full or partial')
  const raw = Array.isArray(value) ? value : value === '' ? [] : String(value).split(',')
  if (raw.length > 10000) throw Error('At most 10000 selected parcels are supported')
  const parcels = [
    ...new Set(
      raw.map((item) => {
        if (!/^\d+$/.test(String(item))) throw Error('Parcel IDs must be positive integers')
        const id = Number(item)
        if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw Error('Invalid parcel ID')
        return id
      }),
    ),
  ].sort((a, b) => a - b)
  if (mode === 'partial' && !parcels.length) throw Error('Partial nodes require selected parcels')
  if (mode === 'full' && parcels.length) throw Error('Full nodes cannot restrict parcels; use partial mode')
  return { mode, parcels: mode === 'partial' ? parcels : null }
}
export function hostsParcel(scope, parcel) {
  return Number.isSafeInteger(parcel) && parcel > 0 && (scope.parcels === null || scope.parcels.includes(parcel))
}
export function intersectParcels(a, b) {
  if (a === null) return b
  if (b === null) return a
  const selected = new Set(b)
  return a.filter((id) => selected.has(id))
}
