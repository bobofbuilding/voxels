import { ethers } from 'ethers'
import db from '../pg'
import { ethAlchemy, parcelInterface, ADDRESSES } from '../lib/utils'
import Parcel from '../parcel'
import { named } from '../lib/logger'

const log = named('parcel-transfers')

const PARCEL = process.env.CONTRACT_ADDRESS || ADDRESSES.PARCEL_ADDRESS
const TRANSFER = ethers.id('Transfer(address,address,uint256)')
// _tokenId isn't indexed on this old contract, so alchemy_getAssetTransfers files it as erc20. plain getLogs it is.
// alchemy caps getLogs ranges on smaller plans, 2k blocks is always safe
const WINDOW = 2000
const MAX_WINDOWS = 50 // ~2 weeks of blocks per run, a cold backfill catches up over a few runs
const BACKFILL = 7200 * 30 // ~30 days when the table is empty

let cursor = 0 // last block this worker scanned. lost on restart, so we rescan from the newest stored transfer

export async function syncTransfers() {
  if (!process.env.ALCHEMY_ETH_API_KEY) return

  const head = await ethAlchemy.getBlockNumber()
  if (!cursor) {
    const r = await db.query('sql/max-transfer-block', 'select max(block) as block from parcel_transfers')
    const b = r.rows[0]?.block
    cursor = b ? b - 1 : head - BACKFILL
  }

  for (let i = 0; i < MAX_WINDOWS && cursor < head; i++) {
    const toBlock = Math.min(cursor + WINDOW, head)
    const logs = await ethAlchemy.getLogs({ address: PARCEL, topics: [TRANSFER], fromBlock: cursor + 1, toBlock })
    for (const l of logs) {
      const parsed = parcelInterface.parseLog(l as any)
      if (!parsed) continue
      const block = await l.getBlock()
      await db.query(
        'sql/insert-parcel-transfer',
        `insert into parcel_transfers (hash, log_index, block, parcel_id, from_wallet, to_wallet, created_at)
         values ($1, $2, $3, $4, $5, $6, to_timestamp($7)) on conflict do nothing`,
        [l.transactionHash, l.index, l.blockNumber, Number(parsed.args._tokenId), parsed.args._from, parsed.args._to, block.timestamp],
      )
    }
    cursor = toBlock
  }

  // self-healing: any parcel whose db owner disagrees with its newest transfer gets re-read from the chain.
  // ownerOf is the truth, the event only tells us where to look. a failed rpc just retries next run.
  // todo: security team parcels never take the chain owner so they get re-read every run
  const stale = await db.query(
    'sql/stale-parcel-owners',
    `select id from (
       select distinct on (t.parcel_id) t.parcel_id as id, t.to_wallet, p.owner
         from parcel_transfers t join properties p on p.id = t.parcel_id
        order by t.parcel_id, t.block desc, t.log_index desc
     ) x where lower(owner) is distinct from lower(to_wallet) limit 20`,
  )
  for (const { id } of stale.rows) {
    try {
      await (await Parcel.load(id))?.queryContract()
    } catch (e) {
      log.error(`queryContract ${id} failed: ${e}`)
    }
  }
}
