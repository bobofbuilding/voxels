import pg from 'pg'
import { readFile } from 'node:fs/promises'
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
try {
  // Only a database created by this installer may be reused. Never adopt a live DB.
  const marker = await db.query("SELECT to_regclass('public.node_installation') AS installed")
  if (marker.rows[0].installed) {
    const result = await db.query('SELECT completed FROM node_installation WHERE id=1')
    if (result.rows[0]?.completed) {
      console.log('Existing node database retained.')
      process.exitCode = 0
    } else throw Error('Incomplete import. Inspect the node database; no automatic overwrite is allowed.')
  } else {
    const existing = await db.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")
    if (existing.rows[0].count) throw Error('Nonempty database without installer marker; refusing to modify it.')
    await db.query('BEGIN')
    const schema = (await readFile('db/schema.sql', 'utf8')).replace(/^\\(?:un)?restrict.*$/gm, '')
    await db.query(schema)
    await db.query('CREATE TABLE node_installation (id integer PRIMARY KEY, completed boolean NOT NULL); INSERT INTO node_installation VALUES(1,false)')
    await db.query('COMMIT')
    if (process.env.BOOTSTRAP_MODE === 'inventory') {
      // The importer refuses existing parcels and rolls back on invalid/private data.
      process.argv[2] = '/inventory'
      await import('../world/import-world.mjs')
    } else if (process.env.BOOTSTRAP_MODE === 'starter') {
      await db.query('BEGIN')
      const polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-0.5, -0.5],
            [-0.5, 0.5],
            [0.5, 0.5],
            [0.5, -0.5],
            [-0.5, -0.5],
          ],
        ],
      }
      const empty = { type: 'MultiPolygon', coordinates: [] }
      await db.query('INSERT INTO avatars(owner,name) VALUES($1,$2)', [process.env.OWNER_ADDRESS, 'Node operator'])
      await db.query('INSERT INTO islands(id,name,geometry_json,holes_geometry_json,lakes_geometry_json,content) VALUES(1,$1,$2,$3,$3,$4)', ['Node Island', polygon, empty, {}])
      await db.query(
        `INSERT INTO properties(id,owner,address,visible,token,content,minted,name,kind,geometry_json,x1,x2,y1,y2,z1,z2,bounds,island)
        VALUES(1,$1,'Starter parcel',true,1,'{}',false,'Starter parcel','parcel',$2,-8,8,0,20,-8,8,cube(ARRAY[-8.0,0.0,-8.0],ARRAY[8.0,20.0,8.0]),'Node Island')`,
        [process.env.OWNER_ADDRESS, polygon],
      )
      await db.query("SELECT setval('properties_id_seq',1); SELECT setval('islands_id_seq',1)")
      await db.query('REFRESH MATERIALIZED VIEW mv_property_counts; REFRESH MATERIALIZED VIEW mv_space_counts; REFRESH MATERIALIZED VIEW search_corpus')
      await db.query('COMMIT')
    } else throw Error('Unknown bootstrap mode')
    await db.query('UPDATE node_installation SET completed=true WHERE id=1')
    console.log('World initialized; parcel roles preserved, no global account privileges imported.')
  }
} finally {
  await db.end()
}
