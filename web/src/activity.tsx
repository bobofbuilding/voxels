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

export function ActivityFeed({ parcelId }: { parcelId?: number }) {
  const [transfers, setTransfers] = useState<Transfer[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let live = true
    setTransfers(null)
    setError(false)
    cachedFetch(`/api/activity.json${parcelId ? `?parcel=${parcelId}` : ''}`, undefined, 15)
      .then((r) => r.json())
      .then((r) => {
        if (!r.success) throw new Error('Could not load activity')
        if (live) setTransfers(r.transfers)
      })
      .catch(() => {
        if (live) setError(true)
      })
    return () => {
      live = false
    }
  }, [parcelId])

  if (error) return <p>Could not load activity. Try again later.</p>
  if (!transfers) return <p>Loading activity...</p>
  if (!transfers.length) return <p>No transfers yet.</p>

  return (
    <ol class="activity-feed">
      {transfers.map((t) => (
        <li key={t.hash + t.parcel_id}>
          {!parcelId && (
            <a class="activity-parcel" href={`/parcels/${t.parcel_id}`}>
              {t.name || t.address || `Parcel #${t.parcel_id}`}
            </a>
          )}
          <div class="activity-people">
            {typeof t.from === 'object' && t.from.owner === ZERO ? (
              <>
                <span>Minted by</span> <AvatarLink avatar={t.to} />
              </>
            ) : (
              <>
                <AvatarLink avatar={t.from} />
                <span aria-label="transferred to">&rarr;</span>
                <AvatarLink avatar={t.to} />
              </>
            )}
          </div>
          <a class="activity-time" href={`https://etherscan.io/tx/${t.hash}`} target="_blank" rel="noopener noreferrer" title="View transaction">
            <time dateTime={t.created_at}>{format(t.created_at)}</time>
          </a>
        </li>
      ))}
    </ol>
  )
}

export function ActivitySection({ parcelId }: { parcelId?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <details class="inspector-section" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>activity</summary>
      {open && <ActivityFeed parcelId={parcelId} />}
    </details>
  )
}

export default function Activity(_props: { path?: string }) {
  return (
    <section>
      <Head title="Activity" url="/activity" />
      <h1>Activity</h1>
      <ActivityFeed />
    </section>
  )
}
