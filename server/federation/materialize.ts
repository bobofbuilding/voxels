import ndarray from 'ndarray'
import { inflateSync } from 'node:zlib'
import { getBufferFromVoxels, getVoxelsFromBuffer } from '../../common/voxels/helpers'
import { compareEdits, WorldEdit } from '../../common/federation/edit'

/** Replay a durable set in causal-clock/hash order; arrival order never decides the result. */
export function materialize(base: Record<string, any>, edits: WorldEdit[], shape: [number, number, number]) {
  let content = structuredClone(base)
  const volume = shape.reduce((a, b) => a * b, 1)
  if (!Number.isSafeInteger(volume) || volume < 0 || volume > 64_000_000) throw Error('Unsupported parcel dimensions')
  let field: ReturnType<typeof getBufferFromVoxels>
  const decode = (voxels: string) => {
    const result = ndarray(new Uint16Array(volume), shape)
    if (voxels) new Uint8Array(result.data.buffer).set(inflateSync(Buffer.from(voxels, 'base64'), { maxOutputLength: Math.max(1, volume * 2) }))
    return result
  }
  let changedVoxels = false
  let features = new Map<string, any>((content.features || []).filter(Boolean).map((f: any) => [f.uuid, f]))
  for (const edit of [...edits].sort(compareEdits))
    for (const patch of edit.patches) {
      if ('content' in patch) {
        if (!patch.content || typeof patch.content !== 'object' || Array.isArray(patch.content)) throw Error('Invalid replacement build')
        content = structuredClone(patch.content)
        if (content.features !== undefined && !Array.isArray(content.features)) throw Error('Invalid replacement features')
        for (const f of content.features || []) if (!f || !/^[a-zA-Z0-9_-]{1,128}$/.test(f.uuid)) throw Error('Invalid replacement feature ID')
        features = new Map((content.features || []).map((f: any) => [f.uuid, f]))
        if (content.voxels !== undefined && typeof content.voxels !== 'string') throw Error('Invalid replacement voxels')
        field = decode(content.voxels)
        changedVoxels = !!content.voxels
      }
      if ('features' in patch) {
        if (!patch.features || Array.isArray(patch.features) || typeof patch.features !== 'object') throw Error('Invalid features')
        for (const [uuid, value] of Object.entries(patch.features)) {
          if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uuid)) throw Error('Invalid feature ID')
          if (value === null) features.delete(uuid)
          else if (value && typeof value === 'object' && !Array.isArray(value)) features.set(uuid, { ...features.get(uuid), ...value, uuid })
          else throw Error('Invalid feature patch')
        }
      }
      if ('voxels' in patch) {
        if (typeof patch.voxels === 'string') {
          content.voxels = patch.voxels
          field = decode(content.voxels)
        } else {
          const { positions, value } = patch.voxels || {}
          if (!Array.isArray(positions) || positions.length > 100_000 || !Number.isInteger(value) || value < 0 || value > 65535) throw Error('Invalid voxel patch')
          field ||= decode(content.voxels) || ndarray(new Uint16Array(volume), shape)
          for (const position of positions) {
            if (!Array.isArray(position) || position.length !== 3 || position.some((v, i) => !Number.isInteger(v) || v < 0 || v >= shape[i])) throw Error('Voxel outside parcel')
            field.set(position[0], position[1], position[2], value)
          }
        }
        changedVoxels = true
      }
      if ('palette' in patch) {
        if (!Array.isArray(patch.palette) || patch.palette.length > 65536) throw Error('Invalid palette')
        content.palette = patch.palette
      }
      if ('tileset' in patch) {
        if (typeof patch.tileset !== 'string' && patch.tileset !== null) throw Error('Invalid tileset')
        content.tileset = patch.tileset
      }
      if ('brightness' in patch) {
        if (!Number.isFinite(patch.brightness) || patch.brightness < 0 || patch.brightness > 10) throw Error('Invalid brightness')
        content.brightness = patch.brightness
      }
    }
  if (changedVoxels) content.voxels = field ? getVoxelsFromBuffer(field.data.buffer) : ''
  content.features = [...features.values()]
  return content
}
