import { SingleParcelRecord } from '../../../common/messages/parcel'
import { ssrFriendlyDocument } from '../../../common/helpers/utils'
import ParcelHelper from '../../../common/helpers/parcel-helper'
import { app } from '../state'
import EditableParcelUsers from './Editable/edit-parcel-users'

type CollaboratorsProps = {
  parcel: SingleParcelRecord
}

export function Collaborators(props: CollaboratorsProps) {
  const isSpace = !!ssrFriendlyDocument?.location?.toString()?.match('/spaces')
  if (isSpace) {
    return null
  }

  const h = new ParcelHelper(props.parcel)
  const isOwner = h.isOwner(app.state.wallet ?? '')

  const showCollaborators = isOwner || (props.parcel.parcel_users && props.parcel.parcel_users.length > 0)
  if (!showCollaborators) {
    return null
  }

  return (
    <div>
      <h3>Collaborators</h3>
      <EditableParcelUsers parcel={props.parcel} />
    </div>
  )
}
