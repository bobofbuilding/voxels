import cors from 'cors'
import { Express, Request, Response } from 'express'
import { PassportStatic } from 'passport'
import cache from './cache'
import getCollectibleMetadata, { getCollectibleMetadataV2 } from './handlers/get-collectible-metadata'
import getTokenMetadata from './handlers/get-token-metadata'

/*
 * OPEN ROUTES, These routes should be Non-CORS protected and available to anyone.
 */
export default function preCorsController(passport: PassportStatic, app: Express) {
  app.get('/p/:id', cors(), cache('60 seconds'), getTokenMetadata)

  // Wearables
  app.get('/w/:id', cache('60 seconds'), (req: Request, res: Response) => {
    const id = Number(req.params.id)
    res.redirect(301, `/c/1/${id}`)
  })

  // Collectibles given the collection
  // Legacy, in the future this should redirect to v2; is currently used by old collections
  app.get('/c/:collection_id/:id', cache('10 minutes'), getCollectibleMetadata)
  app.get('/c/v2/:chain_identifier/:address/:id', cache('10 minutes'), getCollectibleMetadataV2)
}
