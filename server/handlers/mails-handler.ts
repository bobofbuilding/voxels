import { Response } from 'express'
import Mail from '../mail'
import db from '../pg'
import { VoxelsUserRequest } from '../user'

// This file should be called `Postman` instead. lol I'm funny

export async function createMail(req: VoxelsUserRequest, res: Response) {
  const { destinator, subject, content } = req.body
  const sender = req.user?.wallet
  if (!sender) {
    res.status(403).json({ success: false })
  }

  const mail = new Mail({
    sender,
    destinator,
    subject,
    content,
  })
  // check for spam if sender is not system
  const isspammed = mail.destinator == 'system' ? { success: true } : await mail.checkSpam()
  if (!isspammed.success) {
    return isspammed
  }
  //create
  await mail.create()

  res.json({ success: true, mail: { id: mail.id } })
}

export async function markAsRead(req: VoxelsUserRequest, res: Response) {
  const { id } = req.body
  const wallet = req.user?.wallet?.toLowerCase()
  if (!wallet) {
    res.status(403).json({ success: false })
  }

  await db.query(
    'embedded/update-mail-as-read',
    `
    update mails
      set read = true
    where
      id = $1 AND lower(destinator) = $2
    returning
      id
  `,
    [id, wallet],
  )

  const result = await db.query(
    'embedded/update-mail-count',
    `
    select count(*) as unread
    from mails
    where lower(destinator) = $1 and read = false
  `,
    [wallet],
  )

  res.json({ success: true, unreadCount: result.rows[0]?.unread || 0 })
}

export interface mailBody {
  destinator: string
  subject?: string
  content?: string
}

export async function postman(body: mailBody) {
  const sender = 'system'
  const { destinator, subject, content } = body

  const mail = new Mail({
    sender,
    destinator,
    subject,
    content,
  })
  //create
  await mail.create()
}
