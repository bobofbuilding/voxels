import ParcelEventsCharts from './stats/parcel-user-events'
import ParcelVisitsChart from './stats/parcel-visits'
import { FullParcelRecord, ParcelWithMintednessRecord } from '../../../common/messages/parcel'
import { Spinner } from '../spinner'
import { useState } from 'preact/hooks'

export interface Props {
  parcel: ParcelWithMintednessRecord | (ParcelWithMintednessRecord & FullParcelRecord)
}

export default function ParcelStatistics(props: Props) {
  const [showMore, setShowMore] = useState(false)

  if (!props.parcel) return <Spinner size={16} />

  if (!showMore) {
    return (
      <div>
        <div>
          <ParcelVisitsChart parcel={props.parcel} />
        </div>
        <a onClick={() => setShowMore((v) => !v)}>Show more statistics</a>
      </div>
    )
  }

  return (
    <div>
      <div>
        <ParcelVisitsChart parcel={props.parcel} daysToFetch={30} />
      </div>

      <div>
        <ParcelEventsCharts parcel={props.parcel} />
      </div>
      <a onClick={() => setShowMore((v) => !v)}>Show less statistics</a>
    </div>
  )
}
