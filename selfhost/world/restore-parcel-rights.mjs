// Run only against a node whose launch import excluded parcel roles.
// Verify the archive first. This never overwrites existing role assignments.
import pg from 'pg'
import fs from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { archivedParcelRights } from './parcel-rights.mjs'
const root = process.argv[2]
if (!root) throw Error('Supply the verified inventory directory')
const rights = []
for (const filename of (await fs.readdir(path.join(root, 'builds'))).filter((n) => /^\d+\.json\.gz$/.test(n))) {
  const response = JSON.parse(gunzipSync(await fs.readFile(path.join(root, 'builds', filename))))
  if (!response.success || !response.parcel?.visible) throw Error('Unexpected non-public archive record')
  rights.push(archivedParcelRights(response.parcel))
}
if (rights.length !== Number(process.env.EXPECTED_PARCELS || 8807)) throw Error('Unexpected archived parcel count')
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
try {
  await db.query('BEGIN')
  await db.query('LOCK TABLE parcel_users IN EXCLUSIVE MODE')
  if (Number((await db.query('SELECT count(*) AS count FROM parcel_users')).rows[0].count)) throw Error('Existing parcel roles must be reviewed; refusing to overwrite them')
  const columns = await db.query("SELECT 1 FROM information_schema.columns WHERE table_name='federation_base' AND column_name='rights'")
  if (columns.rowCount && Number((await db.query('SELECT count(*) AS count FROM federation_base WHERE rights IS NOT NULL')).rows[0].count)) throw Error('Permission genesis already initialized; use a signed permission change')
  const mismatch = await db.query(`SELECT r.parcel FROM jsonb_to_recordset($1::jsonb) AS r(parcel integer,owner text) LEFT JOIN properties p ON p.id=r.parcel WHERE p.id IS NULL OR NOT p.visible OR lower(p.owner)<>r.owner`, [
    JSON.stringify(rights),
  ])
  if (mismatch.rowCount) throw Error('Live parcel ownership differs from the verified archive; review before restoring rights')
  if (process.argv.includes('--check')) {
    await db.query('ROLLBACK')
    console.log(JSON.stringify({ checkedParcels: rights.length, assignments: rights.reduce((n, r) => n + r.users.length, 0), unresolvedAssignments: rights.reduce((n, r) => n + r.unresolved.length, 0), wouldOverwriteExistingRoles: false }))
    await db.end()
    process.exit(0)
  }
  await db.query(
    `INSERT INTO parcel_users(parcel_id,wallet,role) SELECT r.parcel,u.owner,u.role FROM jsonb_to_recordset($1::jsonb) AS r(parcel integer,users jsonb) CROSS JOIN LATERAL jsonb_to_recordset(r.users) AS u(owner text,role text)`,
    [JSON.stringify(rights)],
  )
  await db.query('CREATE TABLE IF NOT EXISTS parcel_rights_unresolved(parcel_id integer NOT NULL, record jsonb NOT NULL)')
  await db.query(`INSERT INTO parcel_rights_unresolved SELECT r.parcel,u.value FROM jsonb_to_recordset($1::jsonb) AS r(parcel integer,unresolved jsonb) CROSS JOIN LATERAL jsonb_array_elements(r.unresolved) AS u(value)`, [
    JSON.stringify(rights),
  ])
  await db.query('COMMIT')
  console.log(
    JSON.stringify({
      parcels: rights.length,
      restoredRoles: rights.flatMap((r) => r.users).reduce((counts, u) => ({ ...counts, [u.role]: (counts[u.role] || 0) + 1 }), {}),
      restoredAssignments: rights.reduce((n, r) => n + r.users.length, 0),
      unresolvedAssignments: rights.reduce((n, r) => n + r.unresolved.length, 0),
      globalPrivilegesGranted: false,
    }),
  )
} catch (error) {
  await db.query('ROLLBACK')
  throw error
} finally {
  await db.end()
}
