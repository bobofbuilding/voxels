import { Express } from 'express'
import { PassportStatic } from 'passport'
import { BoneNames, Costume } from '../../common/messages/costumes'
import cache from '../cache'
import { createRequestHandlerForQuery } from '../lib/query-helpers'
import { Db } from '../pg'
import { VoxelsUser } from '../user'

export default function CostumesController(db: Db, passport: PassportStatic, app: Express) {
  // Costumes
  app.get(
    '/api/avatars/:wallet/costumes',
    cache(false),
    createRequestHandlerForQuery(db, 'get-costumes', 'costumes', (req) => [req.params.wallet]),
  )

  app.get('/api/costumes/:id', cache(false), async (req, res) => {
    const wallet = req.params.wallet
    const id = req.params.id
    const result = await db.query('sql/get-costume-by-id', `select * from costumes where id=$1`, [id])
    const costume = result.rows[0]

    res.json({ success: true, costume })
  })

  app.put('/api/costumes/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
    // Ensure collection_address and chain_id get populated
    const attachments = req.body.attachments || []
    let errors = []
    for (const a of attachments) {
      if (!a.bone || !BoneNames.includes(a.bone)) {
        a.bone = 'Hips'
      }
      if (!a.wid || typeof a.wid !== 'string') {
        errors.push(`Attachment missing wid, OBJECT: ${JSON.stringify(a)}`)
        continue
      }
    }

    if (errors.length > 0) {
      return res.status(400).send({ success: false, errors })
    }

    const wallet = (req.user as VoxelsUser | null)?.wallet
    if (!wallet) {
      return res.status(401).send({ success: false })
    }

    const id = parseInt(req.params.id, 10)

    if (isNaN(id)) {
      res.json({ success: false })
      return
    }

    const result = await db.query(
      'embedded/update-costume',
      `
    update costumes set
    name=coalesce($1,name),
      attachments=coalesce($2,attachments), skin=coalesce($3, skin), default_color=coalesce($4, '#f3f3f3')
    where
      id=$5 and lower(wallet) = lower($6)
  `,
      [req.body.name, JSON.stringify(attachments), req.body.skin, req.body.default_color, id, wallet],
    )

    // check to see if this is the current costume, if so notify users that costume has changed
    const currentCostumeResult = await db.query('embedded/get-costume', `select costume_id from avatars where lower(avatars.owner) = lower($1) AND costume_id = $2 limit 1`, [wallet, parseInt(req.params.id, 10)])

    // if (currentCostumeResult.rowCount !== null && currentCostumeResult.rowCount > 0) {
    //   // broadcast realtime updates to costumes in world
    //   await publishCostumeChange(wallet)
    // }

    res.json({ success: result.rowCount == 1 })
  })

  app.delete('/api/costumes/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const wallet = (req.user as VoxelsUser | null)?.wallet
    if (!wallet) {
      return res.status(401).send({ success: false })
    }

    const id = parseInt(req.params.id, 10)

    if (isNaN(id)) {
      res.json({ success: false })
      return
    }

    const result = await db.query(
      'embedded/delete-costume',
      `
    delete from
      costumes
    where
      id=$1 and lower(wallet) = lower($2)
  `,
      [id, wallet],
    )

    res.json({ success: result.rowCount == 1 })
  })

  app.post('/api/costumes/create', passport.authenticate('jwt', { session: false }), async (req, res) => {
    let query, params
    const wallet = (req.user as VoxelsUser | null)?.wallet
    if (!wallet) {
      return res.status(401).send({ success: false })
    }

    const { name } = req.body

    if (req.body && 'attachments' in req.body && 'skin' in req.body) {
      // We're uploading a costume
      const { attachments, skin, default_color } = req.body as Partial<Costume>

      let attchs = attachments || []

      const validWearables = attchs.filter((a) => a.wid && typeof a.wid === 'string')

      // Guarantee wearables are not fricking massive and not all over the place; ENFORCE A LIMIT
      const scaleLimit = 8
      const positionLimit = 2.5

      const enforceLimit = (array: number[], limit: number) => {
        if (typeof array != 'object') {
          return [0.5, 0.5, 0.5]
        }
        const safe = []
        for (let i = 0; i < array.length; i++) {
          if (isNaN(parseFloat(array[i] as any))) {
            safe.push(0.5)
            continue
          }
          if (array[i] > limit) {
            safe.push(limit)
          } else if (array[i] < -limit) {
            safe.push(-limit)
          } else {
            safe.push(array[i])
          }
        }
        return safe
      }

      attchs = validWearables.map((a) => {
        a.position = enforceLimit(a.position, positionLimit)
        a.scaling = enforceLimit(a.scaling, scaleLimit)
        if (typeof a.rotation != 'object') {
          a.rotation = [0, 0, 0]
        }
        return a
      })

      query = `
    insert into costumes
      (wallet, name, attachments, skin, default_color)
    values
      ($1, $2, $3, $4, $5)
    returning id`
      params = [wallet, name, JSON.stringify(attchs || []), skin, default_color || '#f3f3f3']
    } else {
      query = `
    insert into costumes
      (wallet, name)
    values
      ($1, $2)
    returning id`
      params = [wallet, name]
    }

    const result = await db.query('embedded/create-costume', query, params)
    const id = result.rows && result.rows[0].id
    const success = result.rowCount == 1
    res.json({ success, id, message: success ? 'Costume created' : 'Failed to create costume' })
  })
}
