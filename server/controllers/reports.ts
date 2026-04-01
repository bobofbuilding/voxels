import { createRequestHandlerForQuery, queryAndCallback } from '../lib/query-helpers'
import cache from '../cache'
import { addReport, removeReport, updateReport } from '../handlers/reports-handler'
import { isMod } from '../lib/helpers'
import { Db } from '../pg'
import { Express } from 'express'
import { PassportStatic } from 'passport'

export default function ModerationReportsController(db: Db, passport: PassportStatic, app: Express) {
  // Favorites
  app.post('/api/reports/create', passport.authenticate('jwt', { session: false }), addReport)
  app.post('/api/reports/remove', passport.authenticate('jwt', { session: false }), removeReport)
  app.post('/api/reports/update', passport.authenticate('jwt', { session: false }), updateReport)

  // API to get all reports made by user x
  app.get('/api/reports.json', cache('10 seconds'), passport.authenticate('jwt', { session: false }), async (req, res) => {
    if (!isMod(req)) {
      res.status(403).json({ success: false })
      return
    }

    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : NaN

    queryAndCallback(
      db,
      'reports/get-reports',
      'reports',
      [`%${req.query.q || ''}%`, isNaN(limit) ? null : req.query.limit, isNaN(page) ? null : req.query.page, req.query.asc === 'true', req.query.type, req.query.onlyNotResolved == 'true'],
      (response) => {
        res.status(response.success ? 200 : 404).json(response)
      },
    )
  })

  // API to get all reports made by user x
  app.get('/api/reports/count.json', cache('10 seconds'), passport.authenticate('jwt', { session: false }), createRequestHandlerForQuery(db, 'reports/get-reports-count', 'total'))
}
