import { getConfig } from '../config'
import { NextFunction, Response } from 'express'
import { SignJWT } from 'jose'
import fetch from 'node-fetch'
import log from '../lib/logger'
import Parcel, { ParcelRef } from '../parcel'
import db from '../pg'
import { VoxelsUserRequest } from '../user'
import { isAdminWallet } from '../permissions'

// Mods are now loaded from the DB instead of being hardcoded a second time here.

//TODO: The commented-out line below would be ideal, but this requires getting top-level await working first (see sc-3508)
//const mods = new Set<string>((await db.query('embedded/fetch-mods', 'select owner from avatars where moderator')).rows.map(({ owner }: { owner: string }) => owner.toLowerCase()))

// Until the async DB call to populate mods completes, isMod() will conservatively return false for any user
let mods = new Set<string>()

// Asynchronously populate mods from the DB
db.query('embedded/fetch-mods', 'select owner from avatars where moderator').then((result) => {
  mods = new Set<string>(result.rows.map(({ owner }: { owner: string }) => owner.toLowerCase()))
  log.info(`loaded ${mods.size} moderators from the DB`)
})

// Group of parcels that will be part of the security auditing performed by Quantum security
const securityTeamParcels = [5067, 5064]

export const isOwner = (req: Pick<VoxelsUserRequest, 'user'>) => {
  return isAdminWallet(req.user?.wallet)
}

export const isMod = (req: Partial<Pick<VoxelsUserRequest, 'user'>>) => !!req.user?.wallet && mods.has(req.user.wallet.toLowerCase())

export const isSecurityTeamParcel = (parcel: Parcel | ParcelRef) => {
  if (!parcel) {
    return false
  }
  return securityTeamParcels.includes(parcel.id)
}

export const isAdmin = (req: Express.Request) => {
  const wallet = req.user ? (req.user as Express.User & { wallet: string }).wallet : null

  if (!wallet) {
    return false
  }

  return isAdminWallet(wallet)
}

// Use after passport.authenticate('jwt') to gate a route to the configured administrator.
export const requireAdmin = (req: Express.Request, res: Response, next: NextFunction) => {
  if (!isAdmin(req)) {
    res.status(403).json({ success: false, message: 'Unauthorized' })
    return
  }
  next()
}

export const isCommonParcel = (parcel: Parcel | ParcelRef) => {
  if (!parcel) {
    return false
  }

  return !!parcel.is_common
}

export const isTestIsland = (parcel: Parcel | ParcelRef) => {
  if (!parcel) {
    return false
  }

  return parcel.island === 'Test Island'
}

export const isShellParcel = (parcel: Parcel | ParcelRef) => {
  if (!parcel) {
    return false
  }

  if (parcel.kind == 'inner') {
    return false
  }

  return !parcel.is_common && parcel.island === 'Architect Island'
}

export async function generateOriginToken(): Promise<string> {
  const payload = { date: Date.now() }
  return new SignJWT(payload as any).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1m').sign(getConfig().jwtKey)
}

export async function callMultiplayerApi(api: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE') {
  const token = await generateOriginToken()
  const p = await fetch(`/mp/api/${api}.json`, {
    headers: { 'x-cryptovoxels-auth': token },
    method,
  })
  return await p.json()
}

export function isHex(num: string) {
  return Boolean(num.match(/^0x[0-9a-f]+$/i)) || (num.startsWith('0x') && Boolean(num.length >= 63))
}

// This REGEX should be safe from ReDOS attacks
// as it does n0t contain any variable repeats, or any alternation inside of repeats
// this is the same regex that is used in the UUID package implementation
const UUID_REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i

export function isValidUUID(uuid: any) {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid)
}
