import { ethers } from 'ethers'
import { getERC20Balance, getParcelsCount, getWalletBalance } from './lib/ethereum-helpers'
import { isCVTeam, isMod } from './lib/helpers'
import { ethAlchemy, TokenAddress } from './lib/utils'
import db from './pg'

export interface SuspendedAvatar {
  wallet: string
  expires_at: Date
  reason: string
}

export default class Avatar {
  static async suspend(wallet: string, reason: string, days: number) {
    const daysStr = days + ' days'
    const res = await db.query(
      'embedded/suspend-avater',
      `
      insert into
        banned_users (wallet, reason, expires_at)
      values
        ($1, $2, now() + $3::interval)
      returning
        wallet, reason, expires_at
    `,
      [wallet, reason, daysStr],
    )

    return res.rows[0] as SuspendedAvatar
  }

  static async unsuspend(wallet: string) {
    const res = await db.query(
      'embedded/unsuspend-avatar',
      `
      update
        banned_users
      set
        expires_at = now()
      where
        lower(wallet) = lower($1) and expires_at>now()
      returning
        wallet,
        reason,
        expires_at
    `,
      [wallet],
    )

    return (res.rows[0] as SuspendedAvatar) || null
  }

  static async getSuspended(wallet: string): Promise<SuspendedAvatar | null> {
    const res = await db.query(
      'embedded/get-suspeneded-avatars',
      `
      select
        * from banned_users
      where
        lower(wallet)=lower($1) and expires_at>now()
      limit
        1
    `,
      [wallet],
    )

    return (res.rows[0] as SuspendedAvatar) || null
  }

  static async fetchNames(wallet: string) {
    if (!ethers.isAddress(wallet)) {
      throw new Error(`${wallet}' is not a valid wallet address`)
    }

    const names = [] // await fetchNamesFromSubGraph(wallet)

    let ensName

    try {
      ensName = await ethAlchemy.lookupAddress(wallet)
    } catch {}

    if (ensName) {
      names.push(ensName)
    }

    let name = null

    if (names.length > 0) {
      await db.query('embedded/set-avatar-name', `update avatars set names=$1 where lower(owner)=lower($2)`, [names, wallet])

      const result = await db.query('embedded/get-avatar-name', `select name from avatars where lower(owner)=lower($1) limit 1;`, [wallet])
      if (result.rows && result.rows[0]) {
        name = result.rows[0].name
      }

      if (!name) {
        // prefer .eth names
        name = names.find((n) => n.match('.eth')) || names[0]

        await db.query('embedded/set-avatar-name', `update avatars set name=$1 where name=null and lower(owner)=lower($2) returning name`, [name, wallet])
      }
    }

    return { name, names }
  }

  static async setENSNameIfAny(wallet: string) {
    let name: string | null = null
    if (!wallet) {
      return name
    }
    try {
      name = await ethAlchemy.lookupAddress(wallet)
    } catch {
      name = null
    }
    if (!name) {
      return name
    }
    await db.query('embedded/set-avatar-name-2', `update avatars set name=$1 where lower(owner)=lower($2)`, [name, wallet])
    return name
  }

  static async getNameByWalletOrDefault(wallet: string): Promise<string> {
    const result = await db.query('embedded/get-avatar-name', `select name from avatars where lower(owner)=lower($1) limit 1`, [wallet])
    return (result.rows && result.rows[0]?.name) || wallet.slice(0, 10)
  }

  static async getParcelsCount(wallet: string): Promise<{
    parcels: number
  }> {
    return await getParcelsCount(wallet)
  }

  static async getBalance(
    wallet: string,
    chain?: number,
  ): Promise<{
    balance: number
  }> {
    return await getWalletBalance(wallet, chain)
  }

  static async getERC20Balance(
    wallet: string,
    address: TokenAddress,
    chain?: number,
  ): Promise<{
    balance: number
  }> {
    return await getERC20Balance(wallet, address, chain!)
  }

  static async isAdmin(wallet: string | undefined) {
    return !!isCVTeam(wallet)
  }

  static async isModerator(wallet: string | undefined) {
    const req = { user: { wallet } }
    return !!isMod(req)
  }
}
