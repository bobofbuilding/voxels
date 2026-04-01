import { Response } from 'express'
import Favorite from '../favorite-parcel'
import { VoxelsUserRequest } from '../user'

export async function addFavoriteParcel(req: VoxelsUserRequest, res: Response) {
  const { parcel_id } = req.body
  const wallet = req.user?.wallet
  if (!wallet) {
    res.status(403).json({ success: false })
  }

  const favorite = new Favorite({
    parcel_id,
    wallet,
  })

  const response = await favorite.create()
  res.json({ success: !!response.success, ...(!!response.message && { message: response.message }) })
}

export async function removeFavoriteParcel(req: VoxelsUserRequest, res: Response) {
  const { parcel_id } = req.body
  const wallet = req.user?.wallet
  if (!wallet) {
    res.status(403).json({ success: false })
  }

  const favorite = new Favorite({
    parcel_id,
    wallet,
  })

  const response = await favorite.remove()
  res.json({ success: !!response.success, ...(!!response.message && { message: response.message }) })
}
