import db from './pg'

export type ModerationReportType = 'avatar' | 'library-asset' | 'collectible' | 'parcel' | 'womps'

export default class ModerationReport {
  // All attributes are usually = to columns in db table
  id: number = undefined!
  type: ModerationReportType = 'avatar' // default is avatar
  author: string = undefined!
  reason: string = undefined!
  extra?: string
  reported_id: string = undefined!
  resolved = false
  created_at: any
  updated_at: any

  constructor(params?: any) {
    if (params) {
      Object.assign(this, params)
    }
  }

  static async loadFromId(id: number): Promise<ModerationReport | null> {
    const res = await db.query('embedded/get-report', `select * from reports where id=$1`, [id])

    if (!res.rows[0]) {
      return null
    }

    return new ModerationReport(res.rows[0])
  }

  /**
   * Load a report from the reported_id and the author's wallet; helps know if user already has reported an asset.
   * @param reported_id
   * @param author
   * @returns
   */
  static async loadFromReportedIdAndAuthor(reported_id: number | string, author: string): Promise<ModerationReport | null> {
    const res = await db.query('embedded/get-report-by-author', `select * from reports where reported_id=$1 and lower(author)=lower($2) order by created_at desc limit 1`, [reported_id, author])

    if (!res.rows[0]) {
      return null
    }

    return new ModerationReport(res.rows[0])
  }

  async create(): Promise<{ success: boolean; message?: string }> {
    const res = await db.query(
      'embedded/insert-report',
      `
      insert into
      reports (type, author,reason,extra,reported_id,created_at,updated_at)
      values
        ($1, lower($2),$3,$4,$5, NOW(), NOW())
      returning
        id
    `,
      [this.type, this.author, this.reason, this.extra, this.reported_id],
    )
    // Returning Id to know if the query has been successful.
    if (!res.rows[0]) {
      return { success: false, message: 'Could not create a report.' }
    }
    this.id = res.rows[0].id
    return { success: true }
  }

  async remove(): Promise<{ success: boolean; message?: string }> {
    const res = await db.query(
      'embedded/delete-report',
      `
    delete
    from
      reports
    where
    id = $1
      returning
      id
  `,
      [this.id],
    )
    if (!res.rows[0]) {
      return { success: false, message: 'Could not remove report.' }
    }
    this.id = res.rows[0].id
    return { success: true }
  }

  async update(): Promise<{ success: boolean; message?: string }> {
    const res = await db.query(
      'embedded/update-report',
      `
      update reports
      set resolved=$2,
      extra=$3,
      updated_at=now()
      where id = $1
      returning
        id
  `,
      [this.id, this.resolved, this.extra],
    )
    if (!res.rows[0]) {
      return { success: false, message: 'Could not update report.' }
    }
    this.id = res.rows[0].id
    return { success: true }
  }
}
