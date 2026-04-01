import { Response } from 'express'
import authParcel from '../auth-parcel'
import { isMod } from '../lib/helpers'
import Parcel from '../parcel'
import ParcelEvent from '../parcel-event'
import { VoxelsUserRequest } from '../user'

export async function createParcelEvent(req: VoxelsUserRequest, res: Response) {
  const { parcel_id, name, description, color, timezone, starts_at, expires_at, category } = req.body
  if (!req.user || !req.user.wallet) {
    res.status(403).json({ success: false })
    return
  }
  const author = req.user.wallet

  const parcel_event = new ParcelEvent({
    author,
    name,
    description,
    color,
    parcel_id,
    timezone,
    starts_at,
    expires_at,
    category,
  })

  const { valid, message } = parcel_event.isValid()
  if (!valid) {
    res.json({ success: false, message: message })
    return
  }

  const parcel = await Parcel.loadRef(parcel_id)

  if (!parcel) {
    res.json({ success: false, message: 'Parcel does not exists' })
    return
  }

  const auth = await authParcel(parcel, req.user)

  if (auth !== 'Owner' && auth !== 'Collaborator') {
    res.json({ success: false, message: 'You do not have the right to create an event' })
    return
  }

  const response = await parcel_event.create()

  res.json({ success: response.success, parcel_event: { id: parcel_event.id }, message: response.message || null })
}

export async function removeParcelEvent(req: VoxelsUserRequest, res: Response) {
  const { id } = req.body
  if (!req.user || !req.user.wallet) {
    res.status(403).json({ success: false })
    return
  }
  const author = req.user.wallet

  const parcelEvent = await ParcelEvent.loadFromId(id)

  if (!parcelEvent || (!isMod(req) && author.toLowerCase() !== parcelEvent.author?.toLowerCase())) {
    res.status(401).json({ success: false })
    return
  }

  const response = await parcelEvent.remove()

  res.json({ success: response.success })
}

export async function updateParcelEvent(req: VoxelsUserRequest, res: Response) {
  const { id, name, description, color, timezone, starts_at, expires_at, category } = req.body
  const user = req.user?.wallet
  if (!user) {
    res.status(403).json({ success: false })
    return
  }

  let parcelEvent = await ParcelEvent.loadFromId(id)
  if (!parcelEvent) {
    res.status(404).json({ success: false })
    return
  }

  if (!isMod(req) && user.toLowerCase() !== parcelEvent.author?.toLowerCase()) {
    res.status(401).json({ success: false, message: 'Only the author can edit this event.' })
    return
  }

  parcelEvent = Object.assign(parcelEvent, { name, description, color, timezone, starts_at, expires_at, category })

  const { valid, message } = parcelEvent.isValid()
  if (!valid) {
    res.json({ success: false, message: message })
    return
  }

  const response = await parcelEvent.update()

  res.json({ success: response.success, parcel_event: { id: response.id } })
}
