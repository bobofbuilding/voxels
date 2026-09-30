import { BrowserProvider } from 'ethers'
import { editMessage, WorldEdit } from '../common/federation/edit'
import { login } from '../web/src/auth/state-login'

let queue = Promise.resolve()
export function submitFederatedEdit(parcel: number, patch: Record<string, any>): Promise<void> {
  const task = queue
    .catch(() => {})
    .then(async () => {
      const info = await fetch('/federation/info', { cache: 'no-store' }).then(async (r) => {
        if (!r.ok) throw Error('Shared-world service unavailable')
        return r.json()
      })
      if (info.world !== process.env.FEDERATION_WORLD) throw Error('World identity mismatch')
      await login.refreshProvider()
      if (!login.provider) throw Error('Connect the editor wallet to save a shared-world edit')
      const signer = await new BrowserProvider(login.provider as any).getSigner()
      if ((await signer.getAddress()).toLowerCase() !== info.editor.toLowerCase()) throw Error('This wallet does not have editing permission for the shared world')
      const head = await fetch(`/federation/parcel/${parcel}`, { cache: 'no-store' }).then(async (r) => {
        if (!r.ok) throw Error('Cannot read parcel revision')
        return r.json()
      })
      const clean = JSON.parse(JSON.stringify(patch, (key, value) => (key === 'children' ? undefined : value)))
      const edit: WorldEdit = { version: 1, world: info.world, parcel, base: head.base, clock: head.clock + 1, parent: head.parent, nonce: crypto.randomUUID().replaceAll('-', ''), patches: [clean], signature: '' }
      edit.signature = await signer.signMessage(editMessage(edit))
      const response = await fetch('/federation/edits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) })
      const result = await response.json()
      if (!response.ok) throw Error(result.error || 'Shared edit was not saved')
    })
  queue = task
  return task
}
