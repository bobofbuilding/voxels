import assert from 'assert'
import { Response } from 'express'
import { authSpace } from '../auth-parcel'
import { isValidUUID } from '../lib/helpers'
import log from '../lib/logger'
import Space from '../space'
import { VoxelsUserRequest } from '../user'

export default async function updateSpace(req: VoxelsUserRequest, res: Response) {
  if (!isValidUUID(req.params.id)) {
    res.status(404).send({ message: 'Not found' })
    return
  }

  const space = await Space.load(req.params.id)
  if (!space) {
    res.json({ success: false, message: 'Does not appear to be a valid Space' })
    return
  }

  try {
    assert(req.body)
  } catch (e) {
    res.json({ success: false, message: 'Does not appear to be a valid update request' })
    return
  }

  if (!req.user) {
    res.json({ success: false, message: 'You do not appear to be logged in' })
    return
  }

  const authResult = await authSpace(space, req.user)
  const wallet = req.user?.wallet ?? 'ANON'

  if (authResult) {
    if ('content' in req.body) {
      space.setContent(req.body.content)
    }
  } else {
    log.warn(`authSpace with user ${wallet} cannot edit ${space.id}`)
    res.json({ success: false, message: 'You do not appear to be the owner or the owner of the parcel has been suspended' })
    return
  }
  let shouldUpdateMeta = false
  let shouldUpdateSpaceScript = false
  if (authResult === 'Owner') {
    const updatedSettings = space.updateSettings(req.body)
    shouldUpdateMeta = !!updatedSettings.shouldUpdateMeta
    shouldUpdateSpaceScript = !!updatedSettings.shouldUpdateParcelScript
  }

  if (authResult !== 'Sandbox') {
    if ('unlisted' in req.body) {
      space.unlisted = req.body.unlisted
      shouldUpdateMeta = true
    }

    if ('name' in req.body) {
      space.name = req.body.name
      shouldUpdateMeta = true
    }

    if ('description' in req.body) {
      space.description = req.body.description
      shouldUpdateMeta = true
    }

    if ('slug' in req.body) {
      const r = await space.updateSlug(req.body.slug)
      if (!r?.success) {
        res.json({ success: false, message: 'Slug is already taken' })
        return
      }
    }
  }

  const result = await space.save()
  shouldUpdateMeta && space.broadcastMeta()
  shouldUpdateSpaceScript && space.broadcastParcelScriptUpdate()
  res.json({ success: !!result })
}
