import { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import ParcelHelper, { ParcelUser } from '../../../../common/helpers/parcel-helper'
import { ssrFriendlyDocument } from '../../../../common/helpers/utils'
import { SingleParcelRecord } from '../../../../common/messages/parcel'
import { app } from '../../state'
import { fetchAPI } from '../../utils'
import { WalletInfo } from '../avatar-profile/wallet-info'
import { PanelType } from '../panel'
import WebContributorsBoxes from '../parcels/web-contributors-boxes'

type nameAddressLookup = Record<string, string | null | undefined>

export default function EditableParcelUsers({ parcel }: { parcel: SingleParcelRecord }) {
  const [addressToName, setAddressToName] = useState<nameAddressLookup>({})
  const [parcelUsers, setParcelUsers] = useState<ParcelUser[]>(parcel.parcel_users ?? [])
  const [editMode, setEditMode] = useState<boolean>(false)

  const helper = new ParcelHelper(parcel)
  const isOwner = () => helper.isOwner(app.state.wallet)

  useEffect(() => {
    setParcelUsers(parcel.parcel_users ?? [])
  }, [parcel.parcel_users])

  useEffect(() => {
    fetchContributorNames(parcel.id.toString(), parcelUsers?.map((r) => r.wallet) || []).then(setAddressToName)
  }, [parcelUsers])

  if (!isOwner()) {
    return <EditableContributorsReadOnly parcelUsers={parcelUsers} contributorNamesByAddress={addressToName} />
  }

  const toggleEditMode: JSX.MouseEventHandler<HTMLButtonElement> = (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    // Renters are considered owners but shouldn't be allowed to edit the parcel-users
    if (!editMode && helper.isRenter(app.state.wallet || '')) {
      app.showSnackbar('Renters cannot edit collaborators', PanelType.Danger)
      return
    }
    if (!editMode && ssrFriendlyDocument?.location.pathname.match('/spaces')) {
      app.showSnackbar('Spaces do not support collaborators', PanelType.Danger)
      return
    }
    setEditMode((prev) => !prev)
  }

  return (
    <div>
      {editMode ? (
        <div>
          <WebContributorsBoxes parcel={parcel} onSave={setParcelUsers} />
        </div>
      ) : (
        <EditableContributorsReadOnly parcelUsers={parcelUsers} contributorNamesByAddress={addressToName} switchMode={setEditMode} />
      )}
      <div>
        <div class={editMode ? 'button-right' : ''}>{EditButton(editMode, toggleEditMode)}</div>
      </div>
    </div>
  )
}

function EditButton(editMode: boolean, onClick: JSX.MouseEventHandler<HTMLButtonElement> | undefined) {
  if (editMode) {
    return <button onClick={onClick}>Done</button>
  }
  return <button onClick={onClick}>Edit</button>
}

type EditableContributorsReadOnlyProps = {
  parcelUsers: ParcelUser[]
  contributorNamesByAddress: nameAddressLookup
  switchMode?: (bool: boolean) => void
}

function EditableContributorsReadOnly({ parcelUsers, contributorNamesByAddress, switchMode }: EditableContributorsReadOnlyProps) {
  if (parcelUsers.length) {
    return (
      <ul>
        {parcelUsers
          .filter((user) => user.role != 'excluded')
          .map((user) => {
            return (
              <li>
                <WalletInfo key={user.wallet} className={'-parcel-page'} name={contributorNamesByAddress[user.wallet]} wallet={user.wallet} showRefresh={false} showViewPage={true} />
              </li>
            )
          })}
      </ul>
    )
  }
  if (switchMode) {
    return (
      <p>
        <a onClick={() => switchMode(true)}>Add collaborator</a>
      </p>
    )
  }
  return <p>This parcel has no collaborators.</p>
}

async function fetchContributorNames(parcelId: string, contributorAddress: string[]): Promise<nameAddressLookup> {
  // Invalidate the cache by the most recent (client's version) copy of the addresses
  const cachebuster = contributorAddress.map((c) => c.substring(2, 7)).join('_')
  const url = `/api/parcels/${parcelId}/users.json?cb=${cachebuster}}`

  type response = { success: boolean; users: (ParcelUser & { name: string })[] }

  return fetchAPI(url).then((r: response) => {
    if (!r.users) {
      return {}
    }
    const result: Record<string, string | undefined> = {}
    contributorAddress.forEach((address) => {
      const u = r.users.find((user) => user.wallet.toLowerCase() == address.toLowerCase())
      if (u?.name) {
        result[address] = u.name
      }
    })
    return result
  })
}
