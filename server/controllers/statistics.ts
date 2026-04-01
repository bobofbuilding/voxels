import { createRequestHandlerForQuery } from '../lib/query-helpers'
import cache from '../cache'
import rateLimit from 'express-rate-limit'
import { numberOfQuarterOfDaySinceGenesis } from '../lib/utils'
import { Db } from '../pg'
import { Express } from 'express'
import { PassportStatic } from 'passport'

export default function (db: Db, passport: PassportStatic, app: Express) {
  const cacheTime = '1 hour'

  app.get(
    '/api/wearables/worn/:id.json',
    cache('10 minutes'),
    createRequestHandlerForQuery(db, 'stats/get-worn-wearable-by-wallet', 'stats', (req) => [req.params.id]),
  )

  app.get(
    '/api/wearables/stats/:id.json',
    cache(cacheTime),
    createRequestHandlerForQuery(db, 'stats/get-stats-by-wearable', 'stats', (req) => [req.params.id, req.query.collection_id ? req.query.collection_id : null]),
  )

  /* World stats */
  app.get('/api/admin/stats/world-parcels-stats.json', cache(cacheTime), createRequestHandlerForQuery(db, 'stats/get-world-parcels-stats', 'stats'))

  app.get('/api/admin/stats/world-traffic.json', cache(cacheTime), createRequestHandlerForQuery(db, 'stats/get-world-traffic', 'stats'))

  app.get(
    '/api/admin/stats/islands/:id/traffic.json',
    cache(cacheTime),
    createRequestHandlerForQuery(db, 'stats/get-island-traffic', 'stats', (req) => [isNaN(parseInt(req.params.id)) ? 1 : parseInt(req.params.id)]),
  )

  /* Event stats*/
  app.get('/api/stats/info-ongoing-events.json', createRequestHandlerForQuery(db, 'stats/get-info-ongoing-events', 'stats'))

  app.get('/api/stats/world-features-stats.json', cache('1 minute'), createRequestHandlerForQuery(db, 'stats/get-world-features-stats', 'stats'))

  /* parcels stats */
  app.get(
    '/api/parcels/emoji/top.json',
    cache('1 minute'),
    createRequestHandlerForQuery(db, 'stats/get-parcels-most-emojis', 'parcels', (req) => [req.query.emoji ? req.query.emoji : null, req.query.recent_interval ? req.query.recent_interval : null]),
  )

  // normally this api is only for the web page and is hit like a few times per minute
  // so for people scraping this, we allow 10 request per 1 minute per IP address per heroku dyno since it's a pretty resource heavy query
  // that is executed
  const trafficApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many request, slow down and check X-RateLimit headers',
    statusCode: 429,
  })
  app.get('/api/parcels/:id/traffic.json', trafficApiLimiter, cache('30 minutes'), (req, res) => {
    const id = Number(req.params.id)
    if (isNaN(id)) {
      res.status(404).json({ success: false })
      return
    }
    let days = 7
    if (req.query.day && typeof req.query.day === 'string') {
      days = parseInt(req.query.day, 10)
      if (isNaN(days)) {
        res.status(400).json({ success: false })
        return
      }
    }

    const genesisQuartDays = numberOfQuarterOfDaySinceGenesis()
    let startQuartDay = genesisQuartDays - days * 4
    let endQuartDay = genesisQuartDays
    if (startQuartDay < 1) startQuartDay = 1
    if (endQuartDay > genesisQuartDays) endQuartDay = genesisQuartDays
    createRequestHandlerForQuery(db, 'stats/get-traffic-by-parcel', 'stats', () => [id, startQuartDay, endQuartDay])(req, res)
  })

  app.get('/api/parcels/traffic/latest.json', cache('8 seconds'), createRequestHandlerForQuery(db, 'stats/get-latest-traffic', 'parcels'))
}
