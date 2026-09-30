import { id, verifyMessage, Signature } from 'ethers'

export type WorldEdit = {
  version: 1 | 2
  authority?: string
  world: string
  parcel: number
  base: string
  clock: number
  parent: string | null
  nonce: string
  patches: Record<string, any>[]
  signature: string
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonical((value as any)[key]))
      .join(',') +
    '}'
  )
}
export function editMessage(edit: Omit<WorldEdit, 'signature'> | WorldEdit): string {
  return `Voxels shared-world edit v${edit.version}${edit.version === 2 ? '\nPermission revision: ' + edit.authority : ''}\nWorld: ${edit.world}\nParcel: ${edit.parcel}\nBase: ${edit.base}\nParent: ${edit.parent || 'genesis'}\nOrder: ${edit.clock}\nNonce: ${edit.nonce}\nChanges: ${id(canonical(edit.patches))}\nAuthorize these public build changes on every host of this world. This is not a transaction.`
}
export function editId(edit: WorldEdit): string {
  return id(editMessage(edit) + '\n' + edit.signature.toLowerCase())
}
export function verifyEdit(edit: WorldEdit, world: string, owner: string): string {
  if (
    !edit ||
    ![1, 2].includes(edit.version) ||
    edit.world !== world ||
    !Number.isSafeInteger(edit.parcel) ||
    edit.parcel < 1 ||
    !Number.isSafeInteger(edit.clock) ||
    edit.clock < 1 ||
    !/^0x[0-9a-f]{64}$/.test(edit.base) ||
    !/^[a-f0-9]{32}$/.test(edit.nonce)
  )
    throw Error('Invalid edit envelope')
  if (edit.version === 2 && !/^0x[0-9a-f]{64}$/.test(edit.authority || '')) throw Error('Invalid permission revision')
  if (edit.parent !== null && !/^0x[0-9a-f]{64}$/.test(edit.parent)) throw Error('Invalid parent revision')
  if (Object.keys(edit).sort().join(',') !== ['version', 'world', 'parcel', 'base', 'clock', 'parent', 'nonce', 'patches', 'signature', ...(edit.version === 2 ? ['authority'] : [])].sort().join(','))
    throw Error('Unsupported envelope field')
  if (Signature.from(edit.signature).serialized !== edit.signature.toLowerCase()) throw Error('Noncanonical signature')
  if (!Array.isArray(edit.patches) || !edit.patches.length || edit.patches.length > 128 || new TextEncoder().encode(canonical(edit)).length > 1_900_000) throw Error('Edit exceeds limits')
  const walk = (value: any, depth = 0) => {
    if (depth > 24) throw Error('Edit is too deeply nested')
    if (value && typeof value === 'object')
      for (const key of Object.keys(value)) {
        if (['__proto__', 'prototype', 'constructor', 'children'].includes(key)) throw Error('Unsafe edit key')
        walk(value[key], depth + 1)
      }
  }
  walk(edit.patches)
  for (const patch of edit.patches) {
    if (
      !patch ||
      typeof patch !== 'object' ||
      Array.isArray(patch) ||
      Object.keys(patch).some((key) => !['voxels', 'features', 'palette', 'tileset', 'brightness', ...(edit.version === 2 ? ['permissions', 'metadata', 'content'] : [])].includes(key))
    )
      throw Error('Unsupported build patch')
  }
  if (verifyMessage(editMessage(edit), edit.signature).toLowerCase() !== owner.toLowerCase()) throw Error('Wallet is not an authorized editor of this world')
  return editId(edit)
}
export function compareEdits(a: WorldEdit, b: WorldEdit) {
  return a.clock - b.clock || (editId(a) < editId(b) ? -1 : editId(a) > editId(b) ? 1 : 0)
}
