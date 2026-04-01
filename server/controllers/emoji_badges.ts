import { createEmojiBadge, removeEmojiBadge } from '../handlers/emoji-badges-handler'
import cache from '../cache'

import { createRequestHandlerForQuery } from '../lib/query-helpers'
import { Db } from '../pg'
import type { PassportStatic } from 'passport'
import type { Express } from 'express'

/* Emoji badges */
export default function EmojiBadges(db: Db, passport: PassportStatic, app: Express) {
  app.post('/api/emojis/add', passport.authenticate('jwt', { session: false }), createEmojiBadge)
  app.post('/api/emojis/remove', passport.authenticate('jwt', { session: false }), removeEmojiBadge)

  app.get(
    '/api/parcels/:id/emojis.json',
    cache('2 seconds'),
    createRequestHandlerForQuery(db, 'emoji_badges/get-emojis-by-parcel', 'emojis', (req) => [req.params.id]),
  )

  app.get(
    '/api/womps/:id/emojis.json',
    cache('2 seconds'),
    createRequestHandlerForQuery(db, 'emoji_badges/get-emojis-by-womp', 'emojis', (req) => [req.params.id]),
  )

  app.get(
    '/api/events/:id/emojis.json',
    cache('2 seconds'),
    createRequestHandlerForQuery(db, 'emoji_badges/get-emojis-by-event', 'emojis', (req) => [req.params.id]),
  )

  app.get(
    '/api/collectibles/w/:id/emojis.json',
    cache('2 seconds'),
    createRequestHandlerForQuery(db, 'emoji_badges/get-emojis-by-wearable', 'emojis', (req) => [req.params.id]),
  )
}
