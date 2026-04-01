import { named } from '../lib/logger'
import db from '../pg'

const log = named('jobs')

export default async function cleanCollections() {
  log.info('cleaning collections table for collections with no addresses.')
  await db.query(
    'embedded/clean-collections',
    `delete from collections
  where address is null and created_at + interval '7 days' < now();`,
  )
}
