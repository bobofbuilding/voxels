import { BrowserProvider } from 'ethers'
import { editMessage, WorldEdit } from '../common/federation/edit'
import { parcelRole, type PermissionState, type ParcelRights } from '../common/federation/permissions'
import { login } from '../web/src/auth/state-login'

export type ParcelAuthority = {
  base: string
  clock: number
  parent: string | null
  permission: PermissionState
  unresolved: { owner: unknown; role: string }[]
  applied: string[]
  pendingCount: number
  pending: { id: string; signer: string }[]
}
let queue = Promise.resolve()
async function read(url: string) {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  const result = await r.json()
  if (!r.ok) throw Error(result.error || 'Connect to an active world host to continue')
  return result
}
export async function readParcelAuthority(parcel: number): Promise<ParcelAuthority> {
  return read(`/federation/parcel/${parcel}`)
}
function submit(parcel: number, makePatches: (head: ParcelAuthority, wallet: string, admin: string) => Record<string, any>[]): Promise<void> {
  const task = queue
    .catch(() => {})
    .then(async () => {
      const info = await read('/federation/info')
      if (info.world !== process.env.FEDERATION_WORLD || info.editor.toLowerCase() !== (process.env.OWNER_ADDRESS || '').toLowerCase()) throw Error('World identity mismatch')
      await login.refreshProvider()
      if (!login.provider) throw Error('Connect your wallet to save changes')
      const signer = await new BrowserProvider(login.provider as any).getSigner(),
        wallet = (await signer.getAddress()).toLowerCase()
      const head = await readParcelAuthority(parcel)
      if (!parcelRole(head.permission, wallet, info.editor)) throw Error('This wallet does not have build rights for this parcel')
      const patches = JSON.parse(JSON.stringify(makePatches(head, wallet, info.editor.toLowerCase()), (key, value) => (key === 'children' ? undefined : value)))
      const edit: WorldEdit = { version: 2, authority: head.permission.id, world: info.world, parcel, base: head.base, clock: head.clock + 1, parent: head.parent, nonce: crypto.randomUUID().replaceAll('-', ''), patches, signature: '' }
      edit.signature = await signer.signMessage(editMessage(edit))
      const response = await fetch('/federation/edits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit), signal: AbortSignal.timeout(15000) })
      const result = await response.json()
      if (!response.ok) throw Error(result.error || 'Changes were not saved')
    })
  queue = task
  return task
}
export function submitFederatedEdit(parcel: number, patch: Record<string, any>): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(patch, (key, value) => (key === 'children' ? undefined : value)))
  return submit(parcel, (head) => {
    if (head.permission.locked) throw Error('The parcel owner must resolve conflicting permission changes before building')
    return [snapshot]
  })
}
export function updateParcelPermissions(parcel: number, users: ParcelRights['users'], approved: string[] = []): Promise<void> {
  return submit(parcel, (head, wallet, admin) => {
    const isOwner = wallet === head.permission.owner || wallet === admin
    if (head.permission.locked && !isOwner) throw Error('Only the parcel owner can resolve permission conflicts')
    return [
      {
        permissions: { epoch: head.permission.epoch + (isOwner ? 1 : 0), root: head.permission.root, users: users.map((u) => ({ owner: u.owner.toLowerCase(), role: u.role })), retained: [...new Set([...head.applied, ...approved])].sort() },
      },
    ]
  })
}
