/**
 * Migration: rewrite costume attachment JSON to use wid (wearables.id uuid)
 * instead of the old wearable_id (token_id int) + collection/chain fields.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx ts-node scripts/migrate-costume-attachments.ts
 *
 * Run with --dry-run to preview without writing.
 */

import { Pool } from 'pg'

const dry = process.argv.includes('--dry-run')

const connectionString = process.env.DATABASE_URL || 'postgres://localhost/voxels'
const pool = new Pool({ connectionString: connectionString.replace(/^postgresql:\/\//, 'postgres://'), ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } })

async function main() {
  const client = await pool.connect()

  try {
    const { rows: wearableRows } = await client.query<{ id: string; token_id: number; collection_id: number }>(`select id, token_id, collection_id from wearables`)
    const widMap = new Map<string, string>()
    for (const w of wearableRows) {
      widMap.set(`${w.collection_id}:${w.token_id}`, w.id)
    }
    console.log(`Loaded ${widMap.size} wearables into lookup table`)

    const { rows: costumes } = await client.query<{ id: number; attachments: any[] | null }>(`select id, attachments from costumes where attachments is not null and json_array_length(attachments) > 0`)

    console.log(`Found ${costumes.length} costumes with attachments`)

    let updated = 0
    let skipped = 0
    let errors = 0

    for (const costume of costumes) {
      const attachments = costume.attachments
      if (!attachments?.length) continue

      const newAttachments = []
      let dirty = false

      for (const a of attachments) {
        if (a.wid) {
          newAttachments.push(a)
          continue
        }

        const wearable_id = a.wearable_id
        const collection_id = a.collection_id ?? 1

        if (!wearable_id) {
          console.warn(`  costume ${costume.id}: attachment has no wearable_id, dropping`)
          dirty = true
          errors++
          continue
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(wearable_id))
        const wid = isUuid ? String(wearable_id) : widMap.get(`${collection_id}:${wearable_id}`)

        if (!wid) {
          console.warn(`  costume ${costume.id}: no wearable found for collection_id=${collection_id} token_id=${wearable_id}, dropping`)
          dirty = true
          errors++
          continue
        }

        const { uuid: _uuid, wearable_id: _wid, collection_id: _cid, chain_id: _chid, collection_address: _caddr, token_id: _tid, ...rest } = a
        newAttachments.push({ ...rest, wid })
        dirty = true
        console.log(`  costume ${costume.id}: resolved token_id=${wearable_id} collection=${collection_id} -> wid=${wid}`)
      }

      if (!dirty) {
        skipped++
        continue
      }

      if (!dry) {
        await client.query(`update costumes set attachments = $1 where id = $2`, [JSON.stringify(newAttachments), costume.id])
      }

      updated++
    }

    console.log(`\nDone. updated=${updated} skipped=${skipped} errors=${errors}${dry ? ' (dry run)' : ''}`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
