import { ethers } from 'ethers'
import cache from '../cache'
import { createMail, markAsRead } from '../handlers/mails-handler'
import { isMod } from '../lib/helpers'

import { createRequestHandlerForQuery } from '../lib/query-helpers'
import { Db } from '../pg'
import { PassportStatic } from 'passport'
import { Express, Response } from 'express'
import { VoxelsUserRequest } from '../user'

export default function MailsController(db: Db, passport: PassportStatic, app: Express) {
  app.put('/api/mails/create', passport.authenticate('jwt', { session: false }), createMail)
  app.put('/api/mails/read', passport.authenticate('jwt', { session: false }), markAsRead)

  app.get('/api/mails/by/:wallet.json', cache('1 seconds'), passport.authenticate('jwt', { session: false }), authWallet, async (req, res) => {
    const result = await db.query(
      'embedded/get-mails-by-wallet',
      `select id,
      sender,
      (select name from avatars where lower(avatars.owner) = lower(mails.sender)) as sender_name,
      destinator,
      subject,
      created_at,
      read,
      convert_from(decrypt(content::bytea, 'salty', 'aes'), 'SQL_ASCII') as content
       from mails
       where
       lower(destinator) = lower($1)
       OR
       lower(sender) = lower($1)
       order by
       created_at desc`,
      [req.params.wallet],
    )
    res.status(200).send({ success: true, mails: result.rows })
  })
}

function authWallet(req: VoxelsUserRequest, res: Response, next: Function) {
  if (!ethers.isAddress(req.params.wallet)) {
    res.status(400).send({ success: false, message: 'Bad Request' })
    return
  }
  if (req.user?.wallet?.toLowerCase() !== req.params.wallet.toLowerCase()) {
    const isModerator = isMod(req)
    if (!isModerator) {
      res.status(401).send({ success: false, message: 'Unauthorized' })
      return
    }
  }

  next()
}
