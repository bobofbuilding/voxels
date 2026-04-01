import { named } from '../lib/logger'
import db from '../pg'

const log = named('jobs')

export default async function cleanMailBoxes() {
  log.info('cleaning mails table')
  await db.query(
    'embedded/clean-mail',
    `delete from mails
  where created_at < now() - interval '6 months';`,
  )
}
