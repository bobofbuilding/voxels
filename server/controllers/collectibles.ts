import { Request, Response } from 'express'
import { ChainIdentifier, getChainIdByName, SUPPORTED_CHAINS } from '../../common/helpers/chain-helpers'
import cache from '../cache'
import { createCollectible, getAmountOfWearable, updateWearable, validateHashWearable } from '../handlers/collectible-handler'
import { createRequestHandlerForQuery, queryAndCallback } from '../lib/query-helpers'
import { parseQueryInt } from '../lib/query-parsing-helpers'
import { Db } from '../pg'
import { identifyCollectionParams } from './collections'

export default function (db: Db, passport: any, app: any) {
  app.get(
    '/api/collectibles.json',
    cache('5 seconds'),
    createRequestHandlerForQuery(db, 'collectibles/get-collectibles', 'collectibles', (req) => {
      const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : NaN

      return [`%${req.query.q || ''}%`, isNaN(page) ? 0 : page - 1, req.query.sort ? req.query.sort : 'updated_at', req.query.asc === 'true']
    }),
  )

  /**
   *   Create any type of collectible
   *  /api/collectibles/create/wearable
   *  /api/collectibles/create/emitter -- in the future
   *  /api/collectibles/create/furniture -- in the future
   * */
  app.post('/api/collectibles/create/wearable', passport.authenticate('jwt', { session: false }), createCollectible)

  // Wearable updates:
  app.post('/api/collectibles/w/:id/update', passport.authenticate('jwt', { session: false }), updateWearable)
  app.post('/api/collectibles/w/:id/suppress', passport.authenticate('jwt', { session: false }), updateWearable)
  app.post('/api/collectibles/w/:id/unsuppress', passport.authenticate('jwt', { session: false }), updateWearable)
  app.post('/api/collectibles/w/:id/delete', passport.authenticate('jwt', { session: false }), updateWearable)

  app.post('/api/collectibles/w/validate-hash', passport.authenticate('jwt', { session: false }), validateHashWearable)

  app.get('/api/collectibles/w/:chain/:address/:id/balanceof/:wallet', cache('30 seconds'), getAmountOfWearable)

  // all collectibles (count)
  app.get('/api/collectibles/info.json', cache('60 seconds'), createRequestHandlerForQuery(db, 'collectibles/get-collectibles-info', 'info'))

  //get a specific collectible given collection id
  app.get(
    '/api/collections/:collection_id/c/:token_id.json',
    cache('60 seconds'),
    createRequestHandlerForQuery(db, 'collectibles/get-collectible', 'collectible', (req) => [parseInt(req.params.collection_id, 10), req.params.token_id]),
  )

  //get a specific collectible given collection address
  app.get(
    '/api/collections/:chain_identifier/:collection_address/c/:token_id.json',
    cache('60 seconds'),
    createRequestHandlerForQuery(db, 'collectibles/get-collectible-by-chain-and-address', 'collectible', (req) => {
      const { chain_identifier, collection_address, token_id } = req.params as { chain_identifier: ChainIdentifier; collection_address: string; token_id: string }
      if (typeof SUPPORTED_CHAINS[chain_identifier] === 'undefined') {
        return [1, collection_address, token_id] // default to ethereum
      }
      if (!collection_address || !token_id) {
        return null
      }
      if (collection_address === 'undefined' || token_id === 'undefined') {
        return null
      }

      if (isNaN(Number(token_id))) {
        return null
      }

      return [getChainIdByName(chain_identifier), collection_address, token_id]
    }),
  )

  // The only time we have `/collectible` (singular)
  app.get(
    '/api/collectibles/wearable/:uuid.json',
    cache('60 seconds'),
    createRequestHandlerForQuery(db, 'collectibles/get-wearable-by-uuid', 'wearable', (req) => [req.params.uuid]),
  )

  const getCollectiblesOfCollection = async (req: Request, res: Response) => {
    const { chain_identifier, address } = req.params as { chain_identifier: ChainIdentifier; address: string }
    if (!chain_identifier || !address) {
      res.status(404).send({ success: false })
      return
    }

    let token_ids: string[] | null = req.query.token_ids ? (req.query.token_ids instanceof Array ? (req.query.token_ids as string[]) : [req.query.token_ids as string]) : null

    if (!token_ids) {
      queryAndCallback(
        db,
        'collectibles/get-collectibles-by-collection',
        'collectibles',
        [getChainIdByName(chain_identifier), address, `%${req.query.q || ''}%`, parseQueryInt(req.query.page, 1) - 1, req.query.sort ? req.query.sort : 'updated_at', req.query.asc === 'true'],
        (response) => {
          res.status(200).send(response)
        },
      )
      return
    }

    token_ids = token_ids.filter((id) => !isNaN(parseInt(id)))

    if (token_ids.length === 0) {
      res.status(200).send({ success: true, collectibles: [] })
      return
    }

    const batch_queries = `select
    w.id,
    token_id,
    w.name,
    w.description,
    collection_id,
    w.category,
    w.author,
    w.hash,
    w.suppressed,
    c.chainid as chain_id,
    c.address as collection_address,
    c.name as collection_name
    from
    wearables w
    left join collections c
    on c.id = w.collection_id
where
 (c.chainid = coalesce($1,1) AND lower(c.address) = lower($2))
  and token_id in (${token_ids.join(',')})
  `
    const r = await db.query('embedded/get-collectibles-batch', batch_queries, [getChainIdByName(chain_identifier), address])
    res.status(200).send({ success: !!r.rows[0], collectibles: r.rows })
  }
  /* Collections */
  // new API
  app.get('/api/collections/:chain_identifier/:address/collectibles.json', identifyCollectionParams, cache('30 seconds'), getCollectiblesOfCollection)

  //Collection submissions

  app.post('/api/collections/collectibles/review.json', passport.authenticate('jwt', { session: false }), async (req: Request, res: Response) => {
    const limit = parseQueryInt(req.query.limit, 50)

    let q = await db.query(
      'embedded/count-collectibles-by-collection',
      `
        select count(id) as total from wearables w where w.token_id is null and suppressed = false and w.collection_id = $1
        `,
      [req.body.collection_id],
    )

    const r = !!q.rows && q.rows[0]

    if (!r) {
      res.status(200).send({ success: false })
      return
    }

    if (!r.total) {
      res.status(200).send({ success: true, collectibles: [], total: 0 })
      return
    }

    q = await db.query(
      'embedded/get-wearables-by-collection-paged',
      `
    select
      *,
      (select name from avatars where avatars.owner = w.author) as author_name
    from
      wearables w
    where
      w.token_id is null and suppressed = false and w.collection_id = $1
      limit
      $2
      offset
      coalesce(($2::integer * $3::integer),0);
    `,
      [req.body.collection_id, limit, parseQueryInt(req.query.page, 0)],
    )
    const response = !!q.rows && (q.rows as any[])

    if (!response) {
      res.status(200).send({ success: false })
      return
    }

    res.status(200).send({ success: true, collectibles: response, total: r.total })
  })

  app.post('/api/collections/collectibles/review/:wallet.json', passport.authenticate('jwt', { session: false }), async (req: Request, res: Response) => {
    const limit = parseQueryInt(req.query.limit, 50)

    let q = await db.query(
      'embedded/get-collectibles-by-wallet',
      `
        select count(id) as total from wearables w where w.token_id is null and suppressed = false and w.collection_id = $1 and lower(w.author) = lower($2);
        `,
      [req.body.collection_id, req.params.wallet],
    )

    const r = !!q.rows && q.rows[0]

    if (!r) {
      res.status(200).send({ success: false })
      return
    }

    if (!r.total) {
      res.status(200).send({ success: true, collectibles: [], total: 0 })
      return
    }

    q = await db.query(
      'embedded/get-wearables-by-wallet-2',
      `
    select
      *,
      (select name from avatars where avatars.owner = w.author) as author_name
    from
      wearables w
    where
      w.token_id is null and suppressed = false and w.collection_id = $1 and lower(w.author) = lower($2)
      limit
      $3
      offset
      coalesce(($3::integer * $4::integer),0);
    `,
      [req.body.collection_id, req.params.wallet, limit, parseQueryInt(req.query.page, 0)],
    )
    const response = !!q.rows && q.rows

    if (!response) {
      res.status(200).send({ success: false })
      return
    }
    res.status(200).send({ success: true, collectibles: response, total: r.total })
  })
}
