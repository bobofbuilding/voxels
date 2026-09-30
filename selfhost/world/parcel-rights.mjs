// Public snapshot records are a migration source, never a node operator's grant.
const walletPattern = /^0x[0-9a-fA-F]{40}$/
export function archivedParcelRights(parcel) {
  const owner = typeof parcel.owner === 'object' ? parcel.owner?.owner : parcel.owner
  if (!Number.isSafeInteger(parcel.id) || parcel.id < 1 || typeof owner !== 'string' || !walletPattern.test(owner)) throw Error('Invalid archived parcel authority')
  if (parcel.parcel_users != null && !Array.isArray(parcel.parcel_users)) throw Error('Invalid archived parcel roles')
  const users = new Map()
  const unresolved = []
  for (const user of parcel.parcel_users || []) {
    const wallet = user?.owner
    if (typeof user?.role !== 'string' || !/^[a-z_-]{1,32}$/.test(user.role)) throw Error(`Invalid archived role for parcel ${parcel.id}`)
    if (typeof wallet !== 'string' || !walletPattern.test(wallet)) {
      unresolved.push({ owner: wallet, role: user.role })
      continue
    }
    const normalized = wallet.toLowerCase()
    if (users.has(normalized) && users.get(normalized) !== user.role) throw Error(`Conflicting archived roles for parcel ${parcel.id}`)
    users.set(normalized, user.role)
  }
  return { unresolved, parcel: parcel.id, owner: owner.toLowerCase(), users: [...users].sort(([a], [b]) => a.localeCompare(b)).map(([owner, role]) => ({ owner, role })) }
}
