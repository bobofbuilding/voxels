import { id, verifyMessage } from 'ethers'
import { canonical, editId, editMessage, compareEdits, type WorldEdit } from './edit'
export type ParcelRights = { owner: string; users: { owner: string; role: string }[] }
export type PermissionChange = { epoch: number; root: string; users: ParcelRights['users']; retained: string[] }
export type PermissionState = ParcelRights & { id: string; root: string; epoch: number; retained: string[]; locked: boolean }
const address = /^0x[0-9a-f]{40}$/
export function normalizeRights(rights: ParcelRights): ParcelRights {
  if (!address.test(rights.owner)) throw Error('Invalid parcel owner')
  if (!Array.isArray(rights.users) || rights.users.length > 10000) throw Error('Invalid parcel roles')
  const seen = new Set<string>()
  const users = rights.users
    .map((user) => {
      if (!user || !address.test(user.owner) || !['owner', 'contributor', 'excluded', 'renter'].includes(user.role) || seen.has(user.owner)) throw Error('Invalid or duplicate parcel role')
      seen.add(user.owner)
      return { owner: user.owner, role: user.role }
    })
    .sort((a, b) => (a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : 0))
  return { owner: rights.owner, users }
}
export function rightsId(rights: ParcelRights) {
  return id(canonical(normalizeRights(rights)))
}
export function parcelRole(rights: ParcelRights, wallet: string, admin: string): 'owner' | 'contributor' | false {
  wallet = wallet.toLowerCase()
  if (wallet === rights.owner || wallet === admin.toLowerCase()) return 'owner'
  const role = rights.users.find((u) => u.owner === wallet)?.role
  return role === 'owner' || role === 'contributor' ? role : false
}
export function isPermissionEdit(edit: WorldEdit) {
  return edit.patches.some((p) => 'permissions' in p)
}
const verifiedSigners = new Map<string, string>()
export function signerOf(edit: WorldEdit) {
  const hash = editId(edit),
    known = verifiedSigners.get(hash)
  if (known) return known
  const signer = verifyMessage(editMessage(edit), edit.signature).toLowerCase()
  if (verifiedSigners.size >= 20000) verifiedSigners.delete(verifiedSigners.keys().next().value!)
  verifiedSigners.set(hash, signer)
  return signer
}
/** Permission branches stop writes until the parcel owner settles them in a new epoch.
 * Each permission change pins the builds it preserves; unseen stale-authority edits
 * remain in the signed log, pending review, rather than silently regaining access. */
export function resolvePermissions(genesis: ParcelRights, events: WorldEdit[], admin: string) {
  genesis = normalizeRights(genesis)
  const genesisId = rightsId(genesis)
  const initial: PermissionState = { ...genesis, id: genesisId, root: genesisId, epoch: 0, retained: [], locked: false }
  const policies = new Map<string, PermissionState>([[genesisId, initial]])
  const roots = [initial]
  const edits = new Map<string, WorldEdit>()
  const authorized = new Set<string>()
  const ordered = [...events].sort(compareEdits)
  for (const event of ordered) {
    const hash = editId(event),
      signer = signerOf(event)
    if (event.version === 1) {
      if (signer !== admin.toLowerCase()) throw Error('Legacy edit requires network owner')
      authorized.add(hash)
      edits.set(hash, event)
      continue
    }
    const parent = policies.get(event.authority!)
    if (!parent) throw Error('Permission revision is missing')
    if ((edits.get(event.authority!)?.clock || 0) >= event.clock) throw Error('Permission revision must precede the edit')
    const role = parcelRole(parent, signer, admin)
    if (!role) throw Error('Wallet has no build rights in the signed permission revision')
    if (isPermissionEdit(event)) {
      if (role !== 'owner' || event.patches.length !== 1 || Object.keys(event.patches[0]).length !== 1) throw Error('Only owners and managers may change parcel rights')
      const change = event.patches[0].permissions as PermissionChange
      const root = policies.get(change?.root)
      if (!root || root.id !== root.root || root.epoch !== parent.epoch || parent.root !== root.id) throw Error('Invalid permission root')
      const isRootOwner = signer === genesis.owner || signer === admin.toLowerCase()
      if (change.epoch !== root.epoch + (isRootOwner ? 1 : 0)) throw Error('Invalid permission epoch')
      const next = normalizeRights({ owner: genesis.owner, users: change.users })
      if (!Array.isArray(change.retained) || change.retained.length > 10000 || new Set(change.retained).size !== change.retained.length) throw Error('Invalid retained edit set')
      for (const retained of change.retained) {
        const previous = edits.get(retained)
        if (!previous || previous.clock >= event.clock || isPermissionEdit(previous) || !authorized.has(retained)) throw Error('Retained edit is missing or invalid')
        if (!isRootOwner && previous.version !== 1 && previous.authority !== parent.id && !parent.retained.includes(retained)) throw Error('Only the parcel owner can approve stale-permission edits')
      }
      const policy = { ...next, id: hash, root: isRootOwner ? hash : root.id, epoch: change.epoch, retained: change.retained, locked: false }
      policies.set(hash, policy)
      if (isRootOwner) roots.push(policy)
    } else {
      for (const patch of event.patches) if (patch.metadata && Object.keys(patch.metadata).some((k) => !['name', 'description'].includes(k)) && role !== 'owner') throw Error('Only managers may change parcel settings')
      authorized.add(hash)
    }
    edits.set(hash, event)
  }
  roots.sort((a, b) => a.epoch - b.epoch || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  let active = roots[roots.length - 1]
  let preserved = new Set(active.retained)
  for (let depth = 0; depth <= events.length; depth++) {
    const children = ordered
      .filter((e) => e.version === 2 && isPermissionEdit(e) && e.authority === active.id)
      .map((e) => policies.get(editId(e))!)
      .filter((p) => p.root === active.root && p.epoch === active.epoch)
    if (!children.length) break
    if (children.length > 1) {
      const intersection = children[0].retained.filter((hash) => children.every((p) => p.retained.includes(hash)))
      preserved = new Set([...active.retained, ...intersection])
      active = { ...active, locked: true }
      break
    }
    active = children[0]
    preserved = new Set(active.retained)
  }
  const applied: WorldEdit[] = [],
    pending: WorldEdit[] = []
  for (const event of ordered) {
    if (isPermissionEdit(event)) continue
    const hash = editId(event)
    if (event.version === 1 || preserved.has(hash) || (!active.locked && event.authority === active.id)) applied.push(event)
    else pending.push(event)
  }
  return { active, policies, applied, pending }
}
