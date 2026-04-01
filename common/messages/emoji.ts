import * as t from 'io-ts'

export const Emojis = ['👍', '❤️', '🔥', '💩', '👌', '😋', '🥴', '🤩', '👀', '🎩', '🙈', '🐙', '🍆', '🍺', '🎷'] as const

export const Emojiable_type = t.union([t.literal('parcels'), t.literal('parcel_events'), t.literal('womps'), t.literal('events'), t.literal('wearables')])

// not sure how to map Emojis to io-ts, so we'll just use a union of literals
export const Emoji = t.union([
  t.literal('👍'),
  t.literal('❤️'),
  t.literal('🔥'),
  t.literal('💩'),
  t.literal('👌'),
  t.literal('😋'),
  t.literal('🥴'),
  t.literal('🤩'),
  t.literal('👀'),
  t.literal('🎩'),
  t.literal('🙈'),
  t.literal('🐙'),
  t.literal('🍆'),
  t.literal('🍺'),
  t.literal('🎷'),
])

export type Emojiable_type = t.TypeOf<typeof Emojiable_type>
export type Emoji = t.TypeOf<typeof Emoji>

export const AggregatedEmoji = t.type({
  emoji: Emoji,
  total: t.number,
  authors: t.array(t.string),
  authors_name: t.array(t.string),
})

export type AggregatedEmoji = t.TypeOf<typeof AggregatedEmoji>
