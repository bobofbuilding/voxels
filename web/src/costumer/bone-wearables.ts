import type { CollectiblesData } from '../../../common/helpers/collections-helpers'

/** Wearables to offer for a skeleton bone (mixamorig short name, e.g. LeftHand). */
export function wearablesForBone(bone: string, wearables: CollectiblesData[]): CollectiblesData[] {
  return wearables.filter((w) => {
    const d = (w.default_bone || '').trim()
    const cat = (w.category || '').toLowerCase()
    if (d === bone) return true
    if (d && bone.startsWith(d)) return true
    if (d && d.startsWith(bone)) return true
    if (!d && (cat === 'hands' || cat === 'arms')) {
      if (bone.startsWith('Left') || bone.startsWith('Right')) return true
    }
    if (!d && cat === 'headwear' && (bone === 'Head' || bone.startsWith('Head'))) return true
    if (!d && cat === 'facewear' && (bone === 'Head' || bone.startsWith('Head'))) return true
    if (!d && cat === 'feet' && bone.includes('Foot')) return true
    return false
  })
}
