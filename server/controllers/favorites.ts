import { queryAndCallback } from '../lib/query-helpers'
import cache from '../cache'
import Favorites from '../favorite-parcel'
import { addFavoriteParcel, removeFavoriteParcel } from '../handlers/favorites-handler'
import { Db } from '../pg'
import { PassportStatic } from 'passport'
import { Express } from 'express'

export default function (db: Db, passport: PassportStatic, app: Express) {
  // Favorites
  app.post('/api/favorites/add', passport.authenticate('jwt', { session: false }), addFavoriteParcel)
  app.post('/api/favorites/remove', passport.authenticate('jwt', { session: false }), removeFavoriteParcel)

  /*
  // API to get all favorites
  app.get('/api/favorites/:wallet.json', cache(false), async (req, res) => {
    queryAndCallback(db, 'favorites/get-favorites-parcels-by-wallet', 'parcels', [req.params.wallet], (response) => {
      res.status(200).send(response)
    })
  })

  // API to get one specific 'favorite' relationship b\etween wallet and parcel_id
  app.get('/api/favorites/:wallet/:parcel_id.json', cache('1 seconds'), async (req, res) => {
    const wallet = req.params.wallet
    const parcel_id = typeof req.params.parcel_id === 'string' ? parseInt(req.params.parcel_id) : NaN
    if (typeof wallet !== 'string' || wallet.length < 39) {
      res.status(400).send({ success: false })
      return
    }

    if (!parcel_id || isNaN(parcel_id)) {
      res.status(400).send({ success: false })
      return
    }

    const favorite = await Favorites.loadFromWalletAndParcelId(wallet, parcel_id)

    res.status(200).send({ success: true, isFavorite: !!favorite })
  })
  */
}
