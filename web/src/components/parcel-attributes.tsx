import { ParcelRecord } from '../../../common/messages/parcel'
import ParcelHelper from '../../../common/helpers/parcel-helper'
import { Fragment } from 'preact'
import { format } from 'timeago.js'

type Props = {
  parcel: ParcelRecord & { traffic_visits?: number }
}

export function ParcelAttributes(props: Props) {
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

  // ideas of things to add to the attribute list
  // created
  // ownership history
  // history in general
  // past events && people attended

  let updated_at = ''
  if ('updated_at' in props.parcel && typeof props.parcel.updated_at === 'string') {
    updated_at = format(Date.parse(props.parcel.updated_at))
  }
  return (
    <dl>
      <dt>Owner</dt>
      <dd>
        <a href={`/u/${props.parcel.owner}`}>{props.parcel.owner.substring(0, 10) + '...'}</a>
      </dd>
      <dt>Token ID</dt>
      <dd>
        <a href={helper.tokenUri}>#{props.parcel.id}</a>
      </dd>
      {props.parcel.traffic_visits ? (
        <Fragment>
          <dt>Visits</dt>
          <dd>{props.parcel.traffic_visits.toLocaleString()}</dd>
        </Fragment>
      ) : null}
      <dt>Dimensions</dt>
      <dd>
        {`${helper.width}m`} &times; {`${helper.depth}m`} and {`${helper.height}m`} tall.
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

      {helper.isSandbox && (
        <Fragment>
          <dt>Sandbox</dt>
          <dd>Yes</dd>
        </Fragment>
      )}

      {updated_at && (
        <Fragment>
          <dt>Updated</dt>
          <dd>{updated_at}</dd>
        </Fragment>
      )}
    </dl>
  )
}
