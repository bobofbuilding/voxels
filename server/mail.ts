import db from './pg'

export default class Mail {
  id: number = undefined!
  content: string = undefined!
  sender: string = undefined!
  destinator: string = undefined!
  subject: string = undefined!
  read: Uint8Array = undefined!
  created_at: any

  constructor(params?: any) {
    if (params) {
      Object.assign(this, params)
    }
  }

  static async loadFromId(id: number): Promise<Mail> {
    const res = await db.query('embedded/get-mail', `select id,sender,destinator,subject,convert_from(decrypt(content::bytea, 'salty', 'aes'), 'SQL_ASCII') as content from mails where id=$1`, [id])

    if (!res.rows[0]) {
      return null!
    }

    return new Mail(res.rows[0])
  }

  async create() {
    const res = await db.query(
      'embedded/insert-mail',
      `
      insert into
        mails (sender, destinator, subject, content)
      values
        ($1, $2, $3, encrypt($4, 'salty', 'aes'))
      returning
        id
    `,
      [this.sender, this.destinator, this.subject, this.content],
    )

    this.id = res.rows[0].id
    return { success: !!res.rows[0] }
  }

  async checkSpam() {
    const res = await db.query(
      'embedded/get-mail-count',
      `
      select
      *
      from
      mails
      where
      lower(destinator) = lower($1)
      and
      created_at > NOW()-interval '3 minutes'
    `,
      [this.destinator],
    )

    if (res.rows && res.rows.length > 5) {
      return { success: false, message: 'Spamming is not cool.' }
    }
    return { success: true }
  }
}
