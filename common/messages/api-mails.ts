////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Types for /api/mails messages

import * as t from 'io-ts'
import { NullableStr } from './feature'

export const MessageRecord = t.type(
  {
    id: t.number,
    sender: t.string,
    sender_name: NullableStr,
    destinator: t.string,
    subject: t.string,
    created_at: t.string,
    read: t.boolean,
    content: t.string,
  },
  'MessageRecord',
)
export type MessageRecord = t.TypeOf<typeof MessageRecord>

// /api/mails/by/(wallet).sjon
export const ApiMails = t.type(
  {
    success: t.boolean,
    mails: t.array(MessageRecord),
  },
  'ApiMails',
)
export type ApiMails = t.TypeOf<typeof ApiMails>

export const ApiMailsUnread = t.type(
  {
    success: t.boolean,
    count: t.type({
      count: t.string,
    }),
  },
  'ApiMails',
)
export type ApiMailsUnread = t.TypeOf<typeof ApiMailsUnread>
