import { Fragment } from 'preact'
import ParcelHelper from '../../../../common/helpers/parcel-helper'
import { ParcelRecord } from '../../../../common/messages/parcel'

interface ParcelDetailsProps {
  parcel: ParcelRecord & { traffic_visits?: number } // special case
}

export function ParcelDetails(props: ParcelDetailsProps) {
  const p = props.parcel.height ? props.parcel : Object.assign(props.parcel, { height: props.parcel.y2 })
  const helper = new ParcelHelper(p)
  const attributes = []

  if (props.parcel.y1 < 0) {
    attributes.push('Basement')
  }

  if (helper.isWaterFront) {
    attributes.push('Waterfront')
  }

  if (props.parcel.kind == 'inner') {
    attributes.push('Prebuilt')
  }

  return (
    <div>
      <h4>Details</h4>
      <dl>
        <dt>Address</dt>
        <dd>
          {props.parcel.address}
          <br />
          {props.parcel.suburb ? (
            <span style={{ opacity: 0.5 }}>
              {props.parcel.suburb}
              <br />
            </span>
          ) : (
            ''
          )}
          <span style={{ opacity: 0.5 }}>{props.parcel.island}</span>
        </dd>
        <dt>Token ID</dt>
        <dd>
          <a href={helper.tokenUri}>#{props.parcel.id}</a>
        </dd>
        {props.parcel.traffic_visits && <dt>Traffic</dt>}
        {props.parcel.traffic_visits && <dd>{props.parcel.traffic_visits} Visits</dd>}
        <dt>Owner</dt>
        <dd>
          <a href={`/u/${props.parcel.owner}`}>{props.parcel.owner.substring(0, 10) + '...'}</a>
        </dd>
        <dt>Size</dt>
        <dd>
          {`${helper.width}m`} wide &times; {`${helper.depth}m`} deep &times; {`${helper.height}m`} tall.
        </dd>
        {props.parcel.y1 > 0 && (
          <Fragment>
            <dt>Elevation</dt>
            <dd>{props.parcel.y1}m.</dd>
          </Fragment>
        )}
        {attributes.length > 0 && (
          <Fragment>
            <dt>Attributes</dt>
            <dd>{attributes.join(', ')}</dd>
          </Fragment>
        )}
      </dl>
    </div>
  )
}
