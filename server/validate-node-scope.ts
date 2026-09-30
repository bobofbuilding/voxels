import db from './pg'
import { coverage } from './node-scope'
// Coverage is fixed to the installation: editing a config file must not silently change what is hosted.
export async function validateNodeScope() {
  if (!process.env.FEDERATION_WORLD) {
    if (coverage.mode === 'partial') throw Error('Partial nodes require shared-world mode')
    return
  }
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('CREATE TABLE IF NOT EXISTS node_coverage(id integer PRIMARY KEY CHECK(id=1), coverage jsonb NOT NULL)')
    const previous = await client.query('SELECT coverage FROM node_coverage WHERE id=1')
    if (previous.rows.length && JSON.stringify(previous.rows[0].coverage.parcels) !== JSON.stringify(coverage.parcels)) throw Error('Node coverage changed: use a new installation with the verified snapshot')
    if (coverage.parcels) {
      const hosted = await client.query('SELECT id FROM properties WHERE visible ORDER BY id')
      if (JSON.stringify(hosted.rows.map((p) => p.id)) !== JSON.stringify(coverage.parcels)) throw Error('Partial node database does not match selected parcels')
    }
    await client.query('INSERT INTO node_coverage VALUES(1,$1) ON CONFLICT DO NOTHING', [coverage])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
