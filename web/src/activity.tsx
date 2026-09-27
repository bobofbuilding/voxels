import { useEffect, useState } from 'preact/hooks'
import { format } from 'timeago.js'
import Head from './components/head'
import { AvatarLink } from './components/avatar-link'
import cachedFetch from './helpers/cached-fetch'
import type { AvatarRef } from '../../common/messages/avatar-ref'

type Transfer = {
  hash: string
  parcel_id: number
  created_at: string
  name: string | null
  address: string | null
  from: AvatarRef
  to: AvatarRef
  synced: boolean | null
}

const ZERO = '0x0000000000000000000000000000000000000000'

export default function Activity(_props: { path?: string }) {
  const [transfers, setTransfers] = useState<Transfer[] | null>(null)

  useEffect(() => {
    cachedFetch('/api/activity.json', undefined, 15)
      .then((r) => r.json())
      .then((r) => setTransfers(r.success ? r.transfers : []))
      .catch(() => setTransfers([]))
  }, [])

  return (
    <section>
      <Head title="Activity" url="/activity" />

      <header>
        <h1>Activity</h1>
        <p>Every parcel changing hands on chain, newest first.</p>
      </header>

      {!transfers ? (
        <p>loading...</p>
      ) : !transfers.length ? (
        <p>nothing yet. the chain is quiet, or the sync hasn't caught up.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>when</th>
              <th>parcel</th>
              <th>from</th>
              <th>to</th>
              <th>db</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.hash + t.parcel_id}>
                <td>
                  <a href={`https://etherscan.io/tx/${t.hash}`} target="_blank">
                    {format(t.created_at)}
                  </a>
                </td>
                <td>
                  <a href={`/parcels/${t.parcel_id}`}>{t.name || t.address || `#${t.parcel_id}`}</a>
                </td>
                <td>{typeof t.from === 'object' && t.from.owner === ZERO ? 'minted' : <AvatarLink avatar={t.from} />}</td>
                <td>
                  <AvatarLink avatar={t.to} />
                </td>
                <td>{t.synced === null ? '' : t.synced ? 'synced' : 'stale'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
