import { h } from 'preact'
import ClientRoot from '../../web/src/client-root'
import JsonData from '../../web/src/components/json-data'
import cache from '../cache'
import renderRoot from '../handlers/render-root'
import { Islands } from '../islands'
import Parcel from '../parcel'
import { Db } from '../pg'
import { PassportStatic } from 'passport'
import { Express } from 'express'
import 'babylonjs' // BABYLON
const isProduction = process.env.NODE_ENV === 'production'

export default function PlayController(db: Db, passport: PassportStatic, app: Express) {
  app.get('/play', cache('60 seconds'), passport.authenticate(['jwt', 'anonymous'], { session: false }), async (req, res) => {
    const islands = await Islands.fetch()

    let parcel: Parcel | null = null

    let nftAuth = false

    // user was rejected from a parcel,
    // get the parcel that rejected the user as fastboot so the bouncer can show the UI saying the user got kickedout
    if (!parcel && req.query.rejectedFrom && !isNaN(parseInt(req.query.rejectedFrom as string))) {
      try {
        parcel = await Parcel.load(parseInt(req.query.rejectedFrom as string))
      } catch (e) {
        parcel = null
      }
    }

    const windowTitle = isProduction ? 'Voxels' : '⚙️ Voxels local'
    const ogTitle = `${parcel?.name || parcel?.address || 'In-world'} | Voxels`
    const ogDescription = parcel?.description ? parcel.description : 'Visit this Voxels Parcel!'
    // Add 'bouncerShouldAllowUser' to the parcel summary
    const summary = (parcel && { ...parcel.summary, ...(nftAuth ? { bouncerShouldAllowUser: true } : {}) }) || {}

    const html = (
      <ClientRoot title={windowTitle} ogTitle={ogTitle} ogDescription={ogDescription}>
        <JsonData id="islands" data={islands} />
        {!!parcel && <JsonData id="parcel" data={summary} dataId={parcel.id} />}
      </ClientRoot>
    )

    res.send(renderRoot(html))
  })
}
