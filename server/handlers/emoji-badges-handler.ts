import type { Response } from 'express'
import EmojiBadges from '../emojis-badges'
import { VoxelsUserRequest } from '../user'

export async function createEmojiBadge(req: VoxelsUserRequest, res: Response) {
  const author = req.user?.wallet
  if (!author) return res.status(401).json({ success: false, message: 'Unauthorized' })
  const { emoji, emojiable_type, emojiable_id } = req.body

  const emojiBadges = new EmojiBadges({
    emoji,
    author,
    emojiable_id,
    emojiable_type,
  })

  const response = await emojiBadges.create()

  res.json(response)
}

export async function removeEmojiBadge(req: VoxelsUserRequest, res: Response) {
  const { emoji, emojiable_type } = req.body
  const author = req.user?.wallet
  if (!author) return res.status(401).json({ success: false, message: 'Unauthorized' })

  const emojiable_id = req.body.emojiable_id as string | number

  const emojiBadges = new EmojiBadges({
    emoji,
    author,
    emojiable_id,
    emojiable_type,
  })

  const response = await emojiBadges.remove()

  res.json(response)
}
