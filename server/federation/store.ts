import { id } from 'ethers'
import db from '../pg'
import { assertHostedParcel } from '../node-scope'
import { canonical, verifyEdit, editId, WorldEdit } from '../../common/federation/edit'
import { getFieldShape } from '../../common/voxels/helpers'
import { materialize } from './materialize'
import { normalizeRights, resolvePermissions, signerOf, isPermissionEdit, parcelRole } from '../../common/federation/permissions'

export const federationWorld = process.env.FEDERATION_WORLD || ''
export async function initializeFederation() {
  await db.query(
    'federation/schema',
    `CREATE TABLE IF NOT EXISTS federation_base(parcel integer PRIMARY KEY, content jsonb NOT NULL, hash text NOT NULL);
    CREATE TABLE IF NOT EXISTS federation_edits(seq bigserial UNIQUE, id text PRIMARY KEY, parcel integer NOT NULL, clock bigint NOT NULL, event jsonb NOT NULL);
    ALTER TABLE federation_base ADD COLUMN IF NOT EXISTS rights jsonb;
    ALTER TABLE federation_base ADD COLUMN IF NOT EXISTS metadata jsonb;
    CREATE TABLE IF NOT EXISTS parcel_rights_unresolved(parcel_id integer NOT NULL, record jsonb NOT NULL);
    CREATE INDEX IF NOT EXISTS federation_parcel_edits ON federation_edits(parcel,clock,id);`,
  )
}
export async function baseAndClock(parcel: number) {
  assertHostedParcel(parcel)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query('SELECT content,visible,owner,name,description,label,settings FROM properties WHERE id=$1 FOR UPDATE', [parcel])
    if (!result.rows[0]?.visible) throw Error('Only public parcels can be synchronized')
    const content = result.rows[0].content || {}
    await client.query('INSERT INTO federation_base(parcel,content,hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [parcel, content, id(canonical(content))])
    const roles = await client.query('SELECT lower(wallet) AS owner,role FROM parcel_users WHERE parcel_id=$1 ORDER BY lower(wallet)', [parcel])
    const rights = normalizeRights(process.env.PARCEL_EDIT_POLICY === 'parcel' ? { owner: result.rows[0].owner.toLowerCase(), users: roles.rows } : { owner: (process.env.OWNER_ADDRESS || '').toLowerCase(), users: [] })
    const { name, description, label, settings } = result.rows[0]
    await client.query('UPDATE federation_base SET rights=COALESCE(rights,$2),metadata=COALESCE(metadata,$3) WHERE parcel=$1', [parcel, rights, { name, description, label, settings }])
    const base = await client.query('SELECT hash,rights FROM federation_base WHERE parcel=$1', [parcel])
    const events = await client.query('SELECT event FROM federation_edits WHERE parcel=$1 ORDER BY clock,id', [parcel])
    const state = resolvePermissions(
      base.rows[0].rights,
      events.rows.map((row) => row.event),
      process.env.OWNER_ADDRESS || '',
    )
    const unresolved = await client.query('SELECT record FROM parcel_rights_unresolved WHERE parcel_id=$1', [parcel])
    const clock = await client.query('SELECT clock::text,id FROM federation_edits WHERE parcel=$1 ORDER BY federation_edits.clock DESC,id DESC LIMIT 1', [parcel])
    await client.query('COMMIT')
    return {
      base: base.rows[0].hash,
      clock: Number(clock.rows[0]?.clock || 0),
      parent: clock.rows[0]?.id || null,
      permission: state.active,
      unresolved: unresolved.rows.map((row) => row.record),
      applied: state.applied.map(editId),
      pendingCount: state.pending.length,
      pending: state.pending.map((edit) => ({ id: editId(edit), signer: signerOf(edit) })),
    }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
export async function acceptEdit(edit: WorldEdit, local = false) {
  const signer = edit?.version === 2 ? signerOf(edit) : process.env.OWNER_ADDRESS || ''
  const hash = verifyEdit(edit, federationWorld, signer)
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
    const previousEvents = await client.query('SELECT event FROM federation_edits WHERE parcel=$1 ORDER BY clock,id', [edit.parcel])
    if (previousEvents.rows.some((row) => editId(row.event) === hash)) {
      await client.query('COMMIT')
      return hash
    }
    const previous = resolvePermissions(
      base.rows[0].rights,
      previousEvents.rows.map((row) => row.event),
      process.env.OWNER_ADDRESS || '',
    )
    const isRoot = signer.toLowerCase() === base.rows[0].rights.owner || signer.toLowerCase() === (process.env.OWNER_ADDRESS || '').toLowerCase()
    if (local && edit.version === 2 && (edit.authority !== previous.active.id || (previous.active.locked && !(isRoot && isPermissionEdit(edit))))) throw Error('Parcel permissions changed or conflict. Refresh the manager before saving.')
    if (!isPermissionEdit(edit)) materialize(base.rows[0].content, [edit], getFieldShape(result.rows[0]))
    const inserted = await client.query('INSERT INTO federation_edits(id,parcel,clock,event) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id', [hash, edit.parcel, edit.clock, edit])
    if (inserted.rowCount) {
      const events = await client.query('SELECT event FROM federation_edits WHERE parcel=$1 ORDER BY clock,id', [edit.parcel])
      if (events.rowCount! > 10000) throw Error('Parcel edit log requires compaction; refusing to discard history')
      const state = resolvePermissions(
        base.rows[0].rights,
        events.rows.map((row) => row.event),
        process.env.OWNER_ADDRESS || '',
      )
      const content = materialize(base.rows[0].content, state.applied, getFieldShape(result.rows[0]))
      const metadata = { ...base.rows[0].metadata }
      for (const event of state.applied)
        for (const patch of event.patches)
          if (patch.metadata) {
            if (!patch.metadata || Array.isArray(patch.metadata) || typeof patch.metadata !== 'object') throw Error('Invalid parcel metadata')
            for (const [key, value] of Object.entries(patch.metadata)) {
              if (!['name', 'description', 'label', 'settings'].includes(key)) throw Error('Unsupported parcel metadata')
              if (key === 'settings') {
                if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid parcel settings')
              } else if (value !== null && (typeof value !== 'string' || value.length > (key === 'description' ? 4096 : 256))) throw Error('Invalid parcel text')
              metadata[key] = value
            }
          }
      await client.query('UPDATE properties SET name=$2,description=$3,label=$4,settings=$5 WHERE id=$1', [edit.parcel, metadata.name, metadata.description, metadata.label, metadata.settings || {}])
      await client.query('DELETE FROM parcel_users WHERE parcel_id=$1', [edit.parcel])
      for (const user of state.active.users) await client.query('INSERT INTO parcel_users(parcel_id,wallet,role) VALUES($1,$2,$3)', [edit.parcel, user.owner, user.role])
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

export async function permissionForWallet(parcel: number, wallet: string) {
  const state = await baseAndClock(parcel)
  return { role: state.permission.locked ? false : parcelRole(state.permission, wallet, process.env.OWNER_ADDRESS || ''), state }
}
