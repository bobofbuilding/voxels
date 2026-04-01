import { Response } from 'express'
import authParcel from '../auth-parcel'
import { parseQueryInt } from '../lib/query-parsing-helpers'
import Parcel from '../parcel'
import ParcelBuilder from '../parcel-builder'
import Space from '../space'
import { VoxelsUserRequest } from '../user'

export default async function BuildRequestHandler(req: VoxelsUserRequest, res: Response) {
  const parcel = await Parcel.load(parseInt(req.params.id, 10))

  if (!parcel) {
    res.json({ success: false })
    return
  }

  const auth = await authParcel(parcel, req.user ?? null)

  if (auth !== 'Owner') {
    res.json({ success: false, error: 'Only owner or co-owners can use this tool' })
    return
  }

  const funcName = req.query['function']
  if (!funcName || typeof funcName !== 'string') {
    res.json({ success: false, error: 'No function specified' })
    return
  }

  const f = (ParcelBuilder as unknown as Record<string, Function>)[funcName]

  if (!f) {
    res.json({ success: false, error: 'Invalid function specified' })
    return
  }

  const m: number = parseQueryInt(req.query.material)

  parcel.setContent(f.call(null, parcel, m))

  await parcel.save()

  res.json({ success: true })
}

export async function SpaceBuildRequestHandler(req: VoxelsUserRequest, res: Response) {
  if (typeof req.params.id !== 'string') {
    res.status(404).json({ success: false })
    return
  }
  const space = await Space.load(req.params.id)

  if (!space) {
    res.status(404).json({ success: false })
    return
  }

  if (!req.user || !req.user.wallet || space.owner.toLowerCase() !== req.user.wallet.toLowerCase()) {
    res.json({ success: false })
    return
  }

  const funcName = req.query['function']
  if (!funcName || typeof funcName !== 'string') {
    res.json({ success: false, error: 'No function specified' })
    return
  }

  const f: Function = (ParcelBuilder as any)[funcName]
  const m = parseQueryInt(req.query.material)

  space.setContent(f.call(null, space, m))

  await space.save()

  res.json({ success: true })
}
