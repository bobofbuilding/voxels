import db from './pg'

export default class Favorite {
  // All attributes are usually = to columns in db table
  id: number = undefined!
  parcel_id: string = undefined!
  wallet: string = undefined!
  updated_at: any

  constructor(params?: any) {
    if (params) {
      Object.assign(this, params)
    }
  }

  static async loadFromWalletAndParcelId(wallet: string, parcel_id: number): Promise<Favorite> {
    try {
      const res = await db.query('embedded/get-favorite-parcel', `select * from favorites where lower(wallet)=lower($1) and parcel_id=$2`, [wallet, parcel_id])

      if (!res.rows[0]) {
        return null!
      }

      return new Favorite(res.rows[0])
    } catch (e) {
      console.error(e)
      return null!
    }
  }

  async create(): Promise<{
    success: boolean
    message?: string
  }> {
    const res = await db.query(
      'embedded/insert-favourite-parcel',
      `
      insert into
        favorites (parcel_id, wallet,updated_at)
      values
        ($1, lower($2), NOW())
      returning
        id
    `,
      [this.parcel_id, this.wallet],
    )
    // Returning Id to know if the query has been successful.
    if (!res.rows[0]) {
      return { success: false, message: 'Could not add a favorite.' }
    }
    this.id = res.rows[0].id
    return { success: true }
  }

  async remove(): Promise<{
    success: boolean
    message?: string
  }> {
    const res = await db.query(
      'embedded/delete-favorite-parcel',
      `
    delete
    from
      favorites
    where
    lower(wallet)=lower($1) and parcel_id=$2
      returning
      id
  `,
      [this.wallet, this.parcel_id],
    )
    if (!res.rows[0]) {
      return { success: false, message: 'Could not remove favorite.' }
    }
    this.id = res.rows[0].id
    return { success: true }
  }
}
