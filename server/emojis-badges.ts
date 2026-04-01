import type { Emoji, Emojiable_type } from '../common/messages/emoji'
import db from './pg'

export type EmojiBadge = {
  id?: number
  emoji: Emoji
  author: string
  emojiable_id: string | number
  emojiable_type: Emojiable_type
}
export default class EmojiBadges {
  id: number | undefined = undefined
  emoji: Emoji | undefined = undefined
  author: string | undefined = undefined
  emojiable_id: string | number | undefined = undefined
  emojiable_type: Emojiable_type | undefined = undefined

  constructor(params: EmojiBadge) {
    Object.assign(this, params)
  }

  validate(): { valid: false; message: string } | { valid: true } {
    if (!this.emoji) return { valid: false, message: 'Emoji is required' }
    if (!this.author) return { valid: false, message: 'Author is required' }
    if (!this.emojiable_id) return { valid: false, message: 'Emojiable_id is required' }
    if (!this.emojiable_type) return { valid: false, message: 'Emojiable_type is required' }
    return { valid: true }
  }

  static async loadFromId(id: number): Promise<EmojiBadges | null> {
    const res = await db.query('embedded/get-emoji-badge', `select * from emoji_badges where id=$1`, [id])

    if (!res.rows[0]) {
      return null
    }

    return new EmojiBadges(res.rows[0])
  }

  async create(): Promise<{ success: false; message: string } | { success: true }> {
    const validationResult = this.validate()
    if (!validationResult.valid) {
      return { success: false, message: validationResult.message }
    }
    /* Check if player already gave a specific emoji */
    const checkUnique = await db.query(
      'embedded/insert-emoji-badge-check-unique',
      `
    select
      count(*)
    from
      emoji_badges
    where
      emojiable_id = $1 AND emojiable_type = $2 AND lower(author) = lower($3) AND emoji = $4
  `,
      [this.emojiable_id, this.emojiable_type, this.author, this.emoji],
    )

    if (checkUnique.rows[0].count >= 1) {
      return { success: false, message: 'You have already given that Emoji!' }
    }

    /* restrict the player to 3 emojis per items */
    const checkEmojiLimit = await db.query<{ count: number }>(
      'embedded/insert-emoji-check-limit',
      `
  select
    count(id)
  from
    emoji_badges
  where
    emojiable_id = $1 AND emojiable_type = $2 AND lower(author) = lower($3)
`,
      [this.emojiable_id, this.emojiable_type, this.author],
    )
    if (checkEmojiLimit.rows[0]?.count >= 3) {
      return { success: false, message: 'You have reached your reaction limit for this item (3 emoji)' }
    }

    const insertResult = await db.query(
      'embedded/insert-emoji-create',
      `
    insert into
      emoji_badges (emojiable_id, emojiable_type, author, emoji, created_at)
    values
      ($1, $2, $3, $4, NOW())
    returning
      id
  `,
      [this.emojiable_id, this.emojiable_type, this.author, this.emoji],
    )

    return insertResult.rows[0]?.id ? { success: true } : { success: false, message: 'Something went wrong.' }
  }

  async remove(): Promise<{ success: false; message: string } | { success: true }> {
    const validationResult = this.validate()
    if (!validationResult.valid) {
      return { success: false, message: validationResult.message }
    }
    const res = await db.query(
      'embedded/delete-emoji-badge',
      `
    DELETE FROM 
      emoji_badges 
    WHERE
    emojiable_id = $1 AND emojiable_type = $2 AND lower(author) = lower($3) AND emoji = $4
    returning
      id
  `,
      [this.emojiable_id, this.emojiable_type, this.author, this.emoji],
    )

    return res.rows[0]?.id ? { success: true } : { success: false, message: 'Could not remove emoji.' }
  }
}
