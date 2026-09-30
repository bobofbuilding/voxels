import pg from 'pg'
import { archivedParcelRights } from './parcel-rights.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const root = process.argv[2]
const existing = await db.query('SELECT count(*)::int AS count FROM properties')
if (existing.rows[0].count !== 0) throw Error('World already has parcels; refusing to overwrite live data')
const suburbs = new Map()
const owners = new Set()
let count = 0
await db.query('BEGIN')
await db.query('CREATE TABLE IF NOT EXISTS parcel_rights_unresolved(parcel_id integer NOT NULL, record jsonb NOT NULL)')
try {
  for (const filename of (await fs.readdir(path.join(root, 'builds'))).filter((x) => /^\d+\.json\.gz$/.test(x)).sort()) {
    const response = JSON.parse(gunzipSync(await fs.readFile(path.join(root, 'builds', filename))))
    const p = response.parcel
    if (!response.success || !p || !p.visible) throw Error('Unexpected non-public build ' + filename)
    let suburbId = null
    if (p.suburb) {
      if (!suburbs.has(p.suburb)) {
        const r = await db.query('INSERT INTO suburbs(name) VALUES($1) RETURNING id', [p.suburb])
        suburbs.set(p.suburb, r.rows[0].id)
      }
      suburbId = suburbs.get(p.suburb)
    }
    const owner = typeof p.owner === 'object' ? p.owner?.owner : p.owner
    if (!owner) throw Error('Missing owner for public parcel ' + p.id)
    if (!owners.has(owner.toLowerCase())) {
      await db.query('INSERT INTO avatars(owner,name) VALUES($1,$2)', [owner, typeof p.owner === 'object' ? p.owner?.name : null])
      owners.add(owner.toLowerCase())
    }
    const fields = {
      id: p.id,
      owner,
      address: p.address,
      visible: true,
      token: p.token,
      content: JSON.stringify(p.content || {}),
      minted: p.minted ?? false,
      name: p.name,
      updated_at: p.updated_at,
      description: p.description,
      kind: p.kind,
      y1: p.y1,
      y2: p.y2,
      island: p.island,
      label: p.label,
      traffic_visits: 0,
      suburb_id: suburbId,
      geometry_json: JSON.stringify(p.geometry),
      is_common: p.is_common ?? false,
      settings: JSON.stringify(p.settings || {}),
      distance_to_center: p.distance_to_center ?? 0,
      distance_to_ocean: p.distance_to_ocean ?? 0,
      distance_to_closest_common: p.distance_to_closest_common ?? 0,
      lightmap_url: p.lightmap_url,
      x1: p.x1,
      x2: p.x2,
      z1: p.z1,
      z2: p.z2,
      sandbox: false,
    }
    const names = Object.keys(fields)
    const values = Object.values(fields)
    await db.query(`INSERT INTO properties(${names.join(',')}) VALUES(${names.map((_, i) => '$' + (i + 1)).join(',')})`, values)
    const rights = archivedParcelRights(p)
    for (const user of rights.users) await db.query('INSERT INTO parcel_users(parcel_id,wallet,role) VALUES($1,$2,$3)', [p.id, user.owner, user.role])
    for (const record of rights.unresolved) await db.query('INSERT INTO parcel_rights_unresolved VALUES($1,$2)', [p.id, record])
    count++
  }
  const islands = JSON.parse(await fs.readFile(path.join(root, 'islands.json'), 'utf8')).islands
  for (const i of islands)
    await db.query('INSERT INTO islands(id,name,texture,holes_geometry_json,lakes_geometry_json,geometry_json,content,other_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [
      i.id,
      i.name,
      i.texture || '/textures/ground.png',
      JSON.stringify(i.holes_geometry_json || { type: 'MultiPolygon', coordinates: [] }),
      JSON.stringify(i.lakes_geometry_json || { type: 'MultiPolygon', coordinates: [] }),
      JSON.stringify(i.geometry),
      JSON.stringify(i.content || {}),
      i.other_name || null,
    ])
  await db.query('UPDATE properties SET bounds=cube(ARRAY[x1::float8,y1::float8,z1::float8], ARRAY[x2::float8,y2::float8,z2::float8])')
  await db.query("SELECT setval('properties_id_seq', (SELECT max(id) FROM properties)); SELECT setval('islands_id_seq', (SELECT max(id) FROM islands))")
  await db.query('REFRESH MATERIALIZED VIEW mv_property_counts; REFRESH MATERIALIZED VIEW mv_space_counts; REFRESH MATERIALIZED VIEW search_corpus')
  if (count !== Number(process.env.EXPECTED_PARCELS || 8807)) throw Error('Unexpected imported parcel count ' + count)
  await db.query('COMMIT')
  console.log(JSON.stringify({ importedParcels: count, islands: islands.length, suburbs: suburbs.size, publicProfiles: owners.size, parcelRolesImported: true, globalModeratorPermissionsImported: false }))
} catch (error) {
  await db.query('ROLLBACK')
  throw error
} finally {
  await db.end()
}
