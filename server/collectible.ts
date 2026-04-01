import db from './pg'

export type CollectibleTableNames = null | 'furnitures' | 'wearables' | 'emitters'

export default class Collectible {
  id: string | undefined = undefined // uuid
  name: string | undefined = undefined
  description: string | undefined = undefined
  author: string | undefined = undefined
  created_at: string | undefined = undefined
  updated_at: string | undefined = undefined
  suppressed = false
  gif?: string

  tableName: CollectibleTableNames = null

  constructor(params?: Partial<Collectible>) {
    if (params) {
      Object.assign(this, params)
    }
  }

  /**
   * Returns the name of the collectible or null
   * Returns {string} or null
   */
  async getAuthorName() {
    let res

    try {
      res = await db.query('embedded/get-avatar-name', `select name from avatars where lower(owner)=lower($1)`, [this.author])
    } catch (e) {
      return null
    }

    if (!res.rows[0]) {
      return null
    }

    return res.rows[0].name
  }

  /**
   * Set rejected_at of a wearable given collection_id and id (uuid)
   */
  async suppress() {
    if (!this.tableName) {
      return
    }
    const r = await db.query(`embedded/suppress-collectible-in-${this.tableName}`, `update ${this.tableName} set suppressed=true where id=$1 returning id`, [this.id])
    const id = r.rows && r.rows[0].id

    return { success: !!id, ...(!id && { message: '❌ Could not suppress nft' }) }
  }
  /**
   * Set rejected_at to null of a wearable given collection_id and id (uuid)
   */
  async unsuppress() {
    if (!this.tableName) {
      return
    }
    const r = await db.query(`embedded/unsuppress-collectible-in-${this.tableName}`, `update ${this.tableName} set suppressed=false where id=$1 returning id`, [this.id])
    const id = r.rows && r.rows[0].id

    return { success: !!id, ...(!id && { message: '❌ Could not unsuppress nft' }) }
  }

  /**
   * Fully delete the wearable if it's not minted and if user is creator
   */
  async delete() {
    if (!this.tableName) {
      return
    }
    const r = await db.query(`embedded/delete-collectible-in-${this.tableName}`, `DELETE FROM ${this.tableName} WHERE id=$1 returning id`, [this.id])
    const id = r.rows && r.rows[0].id
    return { success: !!id, ...(!id && { message: '❌ Could not Remove' }) }
  }

  /**
   * set name or description
   */
  async update() {
    if (!this.tableName) {
      return
    }
    const r = await db.query(`embedded/update-collectible-in-${this.tableName}`, `update ${this.tableName} set name=$1, description=$2 where id=$3 returning id`, [this.name, this.description, this.id])
    const id = r.rows && r.rows[0].id
    return { success: !!id, ...(!id && { message: '❌ Could not update NFT.' }) }
  }
  /**
   * Virtual
   */
  create = async (): Promise<{ success: boolean; message?: string }> => {
    return new Promise((resolve) => resolve({ success: false }))
  }
}
