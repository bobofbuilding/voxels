import db from './pg'
import { EventCategory } from '../common/messages/event'
import { DayMS, HourMS, intervalAsString, milliSecondsToInterval } from '../common/helpers/time-helpers'

export default class ParcelEvent {
  id?: number
  author?: string
  name?: string
  description?: string
  color?: string
  parcel_id?: number
  timezone?: string
  starts_at?: Date
  expires_at?: Date
  created_at?: string | number | Date
  category?: EventCategory

  constructor(params?: any) {
    if (params) {
      Object.assign(this, params)
    }
  }

  static async loadFromId(id: number): Promise<ParcelEvent | null> {
    const res = await db.query('embedded/get-parcel-event', `select * from parcel_events where id=$1`, [id])

    if (!res.rows[0]) {
      return null
    }

    return new ParcelEvent(res.rows[0])
  }

  isValid(): { valid: boolean; message: string } {
    if (!this.starts_at) return { valid: false, message: 'missing start date' }
    if (!this.expires_at) return { valid: false, message: 'missing end date' }
    if (!this.category?.trim()) return { valid: false, message: 'missing category' }
    if (!this.name?.trim()) return { valid: false, message: 'missing name' }

    const durationMS = new Date(this.expires_at).getTime() - new Date(this.starts_at).getTime()

    // we give buffer for when people click start now and depending on network etc we might be a few seconds off.
    const buffer = 60 * 1000
    if (durationMS + buffer < 30 * 60 * 1000) {
      const durString = intervalAsString(milliSecondsToInterval(durationMS))
      return { valid: false, message: `duration can't be less than 30 minutes, ${durString}` }
    }

    const diff = Math.abs(new Date(this.expires_at).getTime() - new Date(this.starts_at).getTime())
    if (this.category === 'exhibition') {
      if (diff > 7 * DayMS) {
        return { valid: false, message: 'the max duration for exhibitions is seven (7) days' }
      }
    } else if (diff > 5 * HourMS) {
      return { valid: false, message: 'the max duration for sessions is five (5) hours' }
    }

    return { valid: true, message: '' }
  }

  async create() {
    /* Check if user is spamming events */
    const res0 = await db.query(
      'embedded/get-parcel-events-by-user',
      `
    SELECT
      *
    FROM
      parcel_events
    WHERE
      parcel_id = $1 AND created_at > (NOW() - INTERVAL '2 hours')
    ORDER BY
      created_at DESC
  `,
      [this.parcel_id],
    )

    if (res0.rows.length >= 4) {
      return { success: false, message: "You're doing this too much" }
    }

    /* Check if parcel already has an event*/
    const res1 = await db.query(
      'embedded/get-parcel-event-by-parcel',
      `
    SELECT
      *
    FROM
      parcel_events
    WHERE
      parcel_id = $1 AND expires_at> NOW()
  `,
      [this.parcel_id],
    )

    if (res1.rows[0]) {
      this.id = res1.rows[0].id
      return { success: false, message: 'Parcel already has an event' }
    }

    /* We now limit events to 2 active events per user */
    const {
      rows: [{ count }],
    } = await db.query(
      'embedded/get-parcel-event-current-count',
      `
    SELECT
      count(*)
    FROM
      parcel_events
    WHERE
      lower(author)=lower($1)
      AND starts_at< NOW()
      AND expires_at> NOW()
      AND COALESCE($2,NOW())::timestamp <= (
        SELECT
          expires_at
          FROM parcel_events
          WHERE
              lower(author)=lower($1)
              AND starts_at< NOW()
              AND expires_at> NOW()
          ORDER BY expires_at DESC
          LIMIT 1
      )
  `,
      [this.author, this.starts_at],
    )

    if (count >= 2) {
      return { success: false, message: 'You can only run 2 events at the same time!' }
    }

    const res = await db.query(
      'embedded/insert-parcel-event',
      `
    INSERT INTO
        parcel_events (parcel_id, author, name, description, color, created_at, timezone, starts_at, expires_at, category)
    VALUES
        ( $1, $2, $3, $4, $5, NOW(), $6, COALESCE($7,NOW()), COALESCE($8,(NOW() + INTERVAL '1 hour')), $9)
    RETURNING
      id
  `,
      [this.parcel_id, this.author, this.name, this.description, this.color, this.timezone, this.starts_at, this.expires_at, this.category],
    )

    if (!res.rows[0]) {
      return { success: false, message: 'Something went wrong' }
    }

    this.id = res.rows[0]?.id
    return { success: !!res.rows[0]?.id, id: res.rows[0]?.id }
  }

  async remove() {
    const res = await db.query(
      'embedded/delete-parcel-event',
      `
  DELETE FROM
    parcel_events
  WHERE
    id = $1
  RETURNING
    id
`,
      [this.id],
    )
    return { success: !!res.rows[0]?.id, id: res.rows[0]?.id }
  }

  async update() {
    const res = await db.query(
      'embedded/update-parcel-event',
      `
  UPDATE
    parcel_events
  SET
    name = $2,
    description = $3,
    color = $4,
    timezone = $5,
    starts_at = COALESCE($6,NOW()),
    expires_at = COALESCE($7,(NOW() + INTERVAL '1 hour')),
    category = $8
  WHERE
    id = $1 AND starts_at > NOW()
  RETURNING
    id
`,
      [this.id, this.name, this.description, this.color, this.timezone, this.starts_at, this.expires_at, this.category],
    )

    console.log(res)
    return { success: !!res.rows[0]?.id, id: res.rows[0]?.id }
  }
}
