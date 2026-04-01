import { ethers } from 'ethers'
import { UserRightRole } from '../common/helpers/parcel-helper'
import db from './pg'

/**
 * This class represents the link between a user (his wallet), a parcel and the user's rights
 */
export default class ParcelUserRight {
  parcel_id: number = undefined!
  wallet: string = undefined!
  role: UserRightRole = 'contributor'

  constructor(params?: { parcel_id: number; wallet: string; role?: UserRightRole }) {
    if (params) {
      Object.assign(this, params)
    }
  }

  /**
   * Returns an object (or null) with the rights of the wallet given the parcel
   * @param parcel_id parcel id
   * @param wallet user's wallet
   * @returns
   */
  static async loadRoleFromParcelIdAndWallet(parcel_id: number, wallet: string) {
    const res = await db.query('embedded/get-parcel-users-by-ids', `select * from parcel_users where parcel_id=$1 and lower(wallet) = lower($2)`, [parcel_id, wallet])

    if (!res.rows[0]) {
      return null!
    }

    return new ParcelUserRight(res.rows[0])
  }

  /**
   * Returns an object (or null) with the rights of the wallet given the parcel
   * @param parcel_id parcel id
   * @param wallet user's wallet
   * @returns
   */
  static async loadUserRightsOfParcel(parcel_id: number): Promise<ParcelUserRight[]> {
    const res = await db.query('embedded/get-parcel-users-by-parcel', `select * from parcel_users where parcel_id=$1`, [parcel_id])

    if (!res.rows[0]) {
      return null!
    }

    return res.rows.map((p: any) => new ParcelUserRight(p))
  }

  /**
   * Returns an object (or null) with the rights of the wallet given the parcel
   * @param parcel_id parcel id
   * @param wallet user's wallet
   * @returns
   */
  static async loadUsersByRole(parcel_id: number, role: UserRightRole = 'contributor'): Promise<ParcelUserRight[] | null> {
    try {
      const res = await db.query('embedded/get-parcel-users-by-parcel-and-role', `select * from parcel_users where parcel_id=$1 and role = $2`, [parcel_id, role])
      if (!res.rows[0]) {
        return []
      }
      return res.rows.map((p: any) => new ParcelUserRight(p))
    } catch {
      return null
    }
  }

  static evictRenter = async (parcel_id: number) => {
    const previousLeasees = await ParcelUserRight.loadUsersByRole(parcel_id, 'renter')
    if (!previousLeasees) {
      // if previousLeasees= null it means the query to DB failed, don't do anything.
      return
    }
    previousLeasees.forEach((leasee) => leasee.delete())
  }

  static createRenter = async (parcel_id: number, wallet: string) => {
    if (!ethers.isAddress(wallet)) {
      return false
    }
    const new_renter = new ParcelUserRight({ parcel_id, wallet, role: 'renter' })
    new_renter.create()
    return true
  }

  /**
   * Create a new role
   */
  async create() {
    await db.query(
      'embedded/insert-parcel-user',
      `
    insert into
      parcel_users (parcel_id, wallet, role)
    values
      ($1, $2, $3)
    ON CONFLICT ON CONSTRAINT parcel_wallet_constraint
    DO
      UPDATE SET role = $3;
  `,
      [this.parcel_id, this.wallet.toLowerCase(), this.role],
    )
    return { success: true }
  }

  async delete() {
    try {
      await db.query(
        'embedded/delete-parcel-user',
        `
      delete from parcel_users where
        parcel_id = $1 and
        lower(wallet) = lower($2)
        returning parcel_id;
    `,
        [this.parcel_id, this.wallet],
      )
    } catch {
      return { success: false, message: `Could not remove user` }
    }
    return { success: true }
  }

  static async deleteAllButRenter(parcel_id: number) {
    try {
      await db.query(
        'embedded/delete-all-parcel-user-but-renter',
        `
      delete from parcel_users where
        parcel_id = $1 and
        role <> 'renter'
        returning parcel_id;
    `,
        [parcel_id],
      )
    } catch {
      return { success: false, message: `Could not remove users` }
    }

    return { success: true }
  }
}
