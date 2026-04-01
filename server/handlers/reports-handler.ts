import { SUPPORTED_CHAINS_BY_ID } from '../../common/helpers/chain-helpers'
import { isMod } from '../lib/helpers'
import ModerationReport from '../report'
import { named } from '../lib/logger'
import { Request, Response } from 'express'
import { VoxelsUserRequest } from '../user'

const log = named('reports-handler')

/**
 *
  id: number = undefined!
  type: ModerationReportType = 'avatar' // default is avatar
  author: string = undefined!
  reason: string = undefined!
  extra?: string
  reported_id: string = undefined!
  resolved: boolean = false
  created_at: any
  updated_at: any
 */

export async function addReport(req: VoxelsUserRequest, res: Response) {
  const { type, reason, extra, reported_id, resolved } = req.body
  const author = req.user?.wallet

  const report = new ModerationReport({
    type,
    reason,
    extra,
    reported_id,
    resolved,
    author,
  })

  if (reason == null || reason?.length == 0) {
    res.json({ success: false, message: 'Invalid reason' })
    return
  }

  if (type == null || type?.length == 0) {
    res.json({ success: false, message: 'Invalid type' })
    return
  }

  const hasUserReportedThisBefore = await ModerationReport.loadFromReportedIdAndAuthor(report.reported_id, report.author)
  // Making sure the same user isn't spamming reports
  if (!!hasUserReportedThisBefore) {
    // issue is not resolved and it's been less than 48hrs since issue creation, don't re-report
    if (!hasUserReportedThisBefore.resolved && hasUserReportedThisBefore.created_at >= Date.now() - 48 * 60 * 60 * 1000) {
      res.json({ success: false, message: 'Already reported' })
      return
    }
  }

  const response = await report.create()
  sendSlackReport(report)
  res.json({ success: !!response.success, ...(!!response.message && { message: response.message }) })
}

export async function removeReport(req: Request, res: Response) {
  const { id } = req.body

  const report = await ModerationReport.loadFromId(id)

  if (!report) {
    res.status(404).json({ success: false })
    return
  }

  if (!isMod(req)) {
    res.status(403).json({ success: false })
    return
  }

  const response = await report.remove()
  res.json({ success: !!response.success, ...(!!response.message && { message: response.message }) })
}

export async function updateReport(req: Request, res: Response) {
  const { id, extra, resolved } = req.body

  if (!id) {
    res.status(404).json({ success: false })
    return
  }

  const report = await ModerationReport.loadFromId(id)

  if (!report) {
    res.status(404).json({ success: false })
    return
  }

  if (!isMod(req)) {
    res.status(403).json({ success: false })
    return
  }

  if (report.resolved !== resolved) {
    report.resolved = resolved
  }

  if (report.extra !== extra) {
    report.extra = extra
  }

  const response = await report.update()
  res.json({ success: !!response.success, ...(!!response.message && { message: response.message }) })
}

async function sendSlackReport(report: ModerationReport) {
  if (!process.env.SLACK_HOOK) {
    throw new Error('SLACK_HOOK env variable must be specified to use bug report.')
  }
  // Redirect to the asset
  let link = `/avatar/${report.reported_id}`
  if (report.type == 'collectible') {
    const [chain_id, collection_address, token_id] = report.reported_id.split(':')
    link = `/collections/${SUPPORTED_CHAINS_BY_ID[parseInt(chain_id)]}/${collection_address}/${token_id}`
  } else if (report.type == 'library-asset') {
    link = `/api/library/asset/${report.reported_id}.json`
  } else if (report.type == 'parcel') {
    link = `/parcels/${report.reported_id}`
  } else if (report.type == 'womps') {
    link = `/womps/${report.reported_id}`
  }

  const body = userReportPayload
  const mainTitle = `**${report.type} reported**\n`
  const reportedObject = `Reported Entity: <${process.env.ASSET_PATH}${link}|${report.reported_id}>\n`
  const reason = `Reason: ${report.reason}\n`
  const extra = `Extra: ${report.extra ? report.extra : '-'}\n`

  body.blocks[0].text!.text = `${mainTitle}
  ${reportedObject}
  ${reason}
  ${extra}`
  body.blocks[2].elements![0].text = `Reported by <https://voxels.com/avatar/${report.author}|${report.author}>, ${new Date().toTimeString()}`

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    authorization: process.env.SLACK_TOKEN || '',
  }

  let result
  try {
    result = await fetch(process.env.SLACK_HOOK, {
      headers,
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch (e) {
    log.error('posting to slack failed', e)
  }
  const p = await result?.text()
  return p == 'ok'
}

const userReportPayload = {
  text: 'User Report!',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '',
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '',
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View reports',
            emoji: true,
          },
          value: 'view_reports',
          url: 'https://voxels.com/admin/m/reports',
        },
      ],
    },
  ],
}
