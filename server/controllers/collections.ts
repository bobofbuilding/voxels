import { ethers } from 'ethers'
import { Express, NextFunction, Request, RequestHandler, Response } from 'express'
import { PassportStatic } from 'passport'
import { ChainIdentifier, getChainIdByName, SUPPORTED_CHAINS_KEYS } from '../../common/helpers/chain-helpers'
import cache, { noCache } from '../cache'
import { checkValidity, createCollection, discontinueCollection, removeCollection, suppressCollection, updateAddress, updateCollection } from '../handlers/collection-handler'
import { createRequestHandlerForQuery } from '../lib/query-helpers'
import { Db, pgp } from '../pg'

export default function (db: Db, passport: PassportStatic, app: Express) {
  /* Collections */
  app.get('/api/collections', cache('5 seconds'), async (req, res) => {
    if (!req.query) {
      return
    }

    const search = `%${req.query.q || ''}%`
    const sortBy = req.query.sort || 'popular'
    const limit = parseInt(req.query.limit as string) || 15
    const page = parseInt(req.query.page as string) || 0

    let orderBy = 'count(w.id) desc' // default for 'popular'

    if (sortBy === 'newest') {
      orderBy = 'c.created_at desc'
    } else if (sortBy === 'oldest') {
      orderBy = 'c.created_at asc'
    }

    const results = await pgp.any(
      `
        select
          c.id,
          c.name,
          c.description,
          c.image_url,
          c.owner,
          c.address,
          c.slug,
          c.type,
          c.chainid,
          c.settings,
          c.suppressed,
          c.rejected_at,
          c.created_at,
          count(w.id) as total_wearables
        from
          collections c
        left join
          wearables w on w.collection_id = c.id and w.token_id is not null
        where
          c.name ilike $<search>
        group by
          c.id
        order by
          ${orderBy}
        limit
          coalesce($<limit>, 15)
        offset
          $<page> * coalesce($<limit>, 15)
        `,
      {
        search,
        limit,
        page,
      },
    )

    res.json({ success: true, collections: results })
  })

  app.get(
    '/api/collections/:id.json',
    cache('5 seconds'),
    createRequestHandlerForQuery(db, 'collections/get-collection', 'collection', (req) => [req.params.id]),
  )
  // V2 api
  app.get(
    '/api/collections/:chain_identifier/:address.json',
    cache('5 seconds'),
    identifyCollectionParams,
    createRequestHandlerForQuery(db, 'collections/get-collection-by-chain-address', 'collection', (req) => [req.params.chain_id, req.params.address]),
  )

  app.get(
    '/api/collections/owned/by/:wallet.json',
    cache('5 seconds'),
    createRequestHandlerForQuery(db, 'collections/get-collections-by-wallet', 'collections', (req) => [req.params.wallet]),
  )

  app.get('/api/collections/:id.png', cache('2 days'), async (req, res) => {
    const collectionId = parseInt(req.params.id, 10)
    if (isNaN(collectionId)) {
      noCache(res)
      return res.status(404).send({ success: false, message: 'Collection not found' })
    }
    const result = await db.query('embedded/get-collection', `SELECT encode(logo, 'escape') as logo,image_url FROM collections WHERE id=$1`, [collectionId])
    const image = result?.rows[0]?.logo
    const image_url = result?.rows[0]?.image_url
    if (!image && !!image_url) {
      noCache(res)
      res.redirect(image_url)
      return
    } else if (!image) {
      noCache(res)
      return res.status(404).send({ success: false, message: 'Collection image not found' })
    }

    const img = Buffer.from(image.substring('data:image/png;base64,'.length, image.length), 'base64')

    res.set('Content-Type', 'image/png')
    res.set('Content-Length', `${img.length}`)
    res.status(200).send(img)
  })

  app.get('/api/collections-info.json', cache('5 seconds'), createRequestHandlerForQuery(db, 'collections/get-collections-info', 'info'))

  // This api route is also used by the contract-listener.
  app.get('/api/collections-addresses.json', cache('30 seconds'), createRequestHandlerForQuery(db, 'collections/get-collections-addresses', 'collections'))

  app.get(
    '/api/collections/:chain_identifier/:address/info.json',
    identifyCollectionParams,
    cache('5 seconds'),
    createRequestHandlerForQuery(db, 'collections/get-collection-info', 'info', (req) => [req.params.chain_id, req.params.address]),
  )

  app.post('/api/collections/validate', passport.authenticate('jwt', { session: false }), checkValidity)
  app.put('/api/collections/create', passport.authenticate('jwt', { session: false }), createCollection)
  app.put('/api/collections/update', passport.authenticate('jwt', { session: false }), updateCollection)
  app.put('/api/collections/update/address', passport.authenticate('jwt', { session: false }), updateAddress)
  app.put('/api/collections/remove', passport.authenticate('jwt', { session: false }), removeCollection)
  app.put('/api/collections/discontinue', passport.authenticate('jwt', { session: false }), discontinueCollection)
  app.put('/api/collections/suppress', passport.authenticate('jwt', { session: false }), suppressCollection)
}

//middleware
export const identifyCollectionParams: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const { chain_identifier, address } = req.params as { chain_identifier: ChainIdentifier; address: string }
  if (!chain_identifier && !address) {
    res.status(404).send({ success: false })
    return
  }

  if (!!chain_identifier && !SUPPORTED_CHAINS_KEYS.includes(chain_identifier)) {
    res.status(404).send({ success: false, error: 'Invalid chain identifier' })
    return
  }

  if (address && !ethers.isAddress(address)) {
    res.status(404).send({ success: false, error: 'Invalid Address' })
    return
  }
  req.params.chain_id = getChainIdByName(chain_identifier).toString()
  next()
}
