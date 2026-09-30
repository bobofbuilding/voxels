import { id } from 'ethers'
import db from '../pg'
import { canonical, verifyEdit, WorldEdit } from '../../common/federation/edit'
import { getFieldShape } from '../../common/voxels/helpers'
import { materialize } from './materialize'

export const federationWorld = process.env.FEDERATION_WORLD || ''
export async function initializeFederation() {
  await db.query(
    'federation/schema',
    `CREATE TABLE IF NOT EXISTS federation_base(parcel integer PRIMARY KEY, content jsonb NOT NULL, hash text NOT NULL);
    CREATE TABLE IF NOT EXISTS federation_edits(seq bigserial UNIQUE, id text PRIMARY KEY, parcel integer NOT NULL, clock bigint NOT NULL, event jsonb NOT NULL);
    CREATE INDEX IF NOT EXISTS federation_parcel_edits ON federation_edits(parcel,clock,id);`,
  )
}
export async function baseAndClock(parcel: number) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query('SELECT content,visible FROM properties WHERE id=$1 FOR UPDATE', [parcel])
    if (!result.rows[0]?.visible) throw Error('Only public parcels can be synchronized')
    const content = result.rows[0].content || {}
    await client.query('INSERT INTO federation_base VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [parcel, content, id(canonical(content))])
    const base = await client.query('SELECT hash FROM federation_base WHERE parcel=$1', [parcel])
    const clock = await client.query('SELECT clock::text,id FROM federation_edits WHERE parcel=$1 ORDER BY clock DESC,id DESC LIMIT 1', [parcel])
    await client.query('COMMIT')
    return { base: base.rows[0].hash, clock: Number(clock.rows[0]?.clock || 0), parent: clock.rows[0]?.id || null }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
export async function acceptEdit(edit: WorldEdit) {
  const hash = verifyEdit(edit, federationWorld, process.env.OWNER_ADDRESS || '')
  await baseAndClock(edit.parcel)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL statement_timeout=30000')
    await client.query('SELECT pg_advisory_xact_lock(867530901)')
    const result = await client.query('SELECT * FROM properties WHERE id=$1 FOR UPDATE', [edit.parcel])
    if (!result.rows[0]?.visible) throw Error('Parcel is no longer public')
    const base = await client.query('SELECT * FROM federation_base WHERE parcel=$1', [edit.parcel])
    if (base.rows[0].hash !== edit.base) throw Error('Snapshot mismatch: nodes must start with the same parcel data')
    const parent = edit.parent ? await client.query('SELECT clock::text,parcel FROM federation_edits WHERE id=$1', [edit.parent]) : null
    if (edit.parent && (!parent?.rows[0] || parent.rows[0].parcel !== edit.parcel)) throw Error('Parent edit is missing or belongs to another parcel')
    if (edit.clock !== Number(parent?.rows[0]?.clock || 0) + 1) throw Error('Invalid causal edit clock')
    const inserted = await client.query('INSERT INTO federation_edits(id,parcel,clock,event) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id', [hash, edit.parcel, edit.clock, edit])
    if (inserted.rowCount) {
      const events = await client.query('SELECT event FROM federation_edits WHERE parcel=$1 ORDER BY clock,id', [edit.parcel])
      if (events.rowCount! > 10000) throw Error('Parcel edit log requires compaction; refusing to discard history')
      const content = materialize(
        base.rows[0].content,
        events.rows.map((row) => row.event),
        getFieldShape(result.rows[0]),
      )
      await client.query('UPDATE properties SET content=$1,memoized_hash=null,hash=null,updated_at=now() WHERE id=$2', [content, edit.parcel])
      // Notifications carry only the ID, keeping large builds below PostgreSQL's payload limit.
      await client.query("SELECT pg_notify('federation_reload',$1)", [JSON.stringify({ parcelId: edit.parcel })])
    }
    await client.query('COMMIT')
    return hash
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
