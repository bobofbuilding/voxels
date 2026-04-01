import { Component } from 'preact'
import ParcelHelper from '../../../common/helpers/parcel-helper'
import { AssetType } from '../../../web/src/components/Editable/editable'
import { saveAsset } from '../../../web/src/helpers/save-helper'
import { app } from '../../../web/src/state'
import type Avatar from '../../avatar'
import type Grid from '../../grid'
import type { Scene } from '../../scene'

interface Props {
  avatar: Avatar
  scene: Scene
}

export default class ParcelOwnerActions extends Component<Props, any> {
  constructor() {
    super()
    this.state = { saving: false /* Whether or not we are in a saving state. */ }
  }

  get avatar() {
    return this.props.avatar as Avatar
  }

  get wallet() {
    return this.avatar.description.wallet
  }

  get grid() {
    return window.grid as Grid
  }

  get currentParcel() {
    if (!this.grid) {
      return null
    }
    return this.grid.currentOrNearestParcel()
  }

  get isOwnerOfCurrentParcel() {
    if (!app.signedIn) {
      return false
    }
    const parcel = this.currentParcel
    if (!parcel) {
      return false
    }
    const helper = new ParcelHelper(parcel)
    return helper.isOwner(app.state.wallet)
  }

  get isContributorOfCurrentParcel() {
    if (!app.signedIn) {
      return false
    }
    const parcel = this.currentParcel
    if (!parcel) {
      return false
    }
    const helper = new ParcelHelper(parcel)
    return !!helper.isContributor(app.state.wallet)
  }

  async setCollaborator(add = true) {
    const parcel = this.currentParcel

    if (!this.wallet) {
      return
    }

    if (!parcel) {
      return
    }
    // Make sure only owner can set Contributors
    if (!this.isOwnerOfCurrentParcel) {
      return
    }
    let response
    const parcel_users = parcel.parcelUsers ? Array.from(parcel.parcelUsers) : []
    this.setState({ saving: true })
    // add contributor.
    if (add) {
      // Check if user is already a contributor
      if (this.isContributorOfCurrentParcel) {
        this.setState({ saving: false })
        return
      }
      parcel_users.push({ wallet: this.wallet, role: 'contributor' })
      response = await saveAsset(AssetType.Parcel, parcel.id, { parcel_users })
    } else {
      // Check if user is already a contributor
      if (!this.isContributorOfCurrentParcel) {
        this.setState({ saving: false })
        return
      }
      const collaborator = parcel_users.find((c) => c.wallet.toLowerCase() == this.wallet?.toLowerCase())
      if (!collaborator) {
        this.setState({ saving: false })
        return
      }
      parcel_users.splice(parcel_users.indexOf(collaborator), 1)
      response = await saveAsset(AssetType.Parcel, parcel.id, { parcel_users })
    }

    this.setState({ saving: false })
    if (response.success) {
      setTimeout(() => {
        this.forceUpdate()
      }, 1000)
    }
  }

  render() {
    if (!this.isOwnerOfCurrentParcel) {
      return null
    }
    return (
      <div className="OverlayHighlightContent -canEdit">
        <h4>
          Parcel Owner Actions{' '}
          <small>
            (#{this.currentParcel!.id} - {this.currentParcel!.name || this.currentParcel!.address})
          </small>
        </h4>

        {!this.props.scene.config.isSpace &&
          (this.isContributorOfCurrentParcel ? (
            <button
              title="This will add this user as contributor to this parcel."
              disabled={this.state.saving}
              onClick={() => {
                !this.state.saving && this.setCollaborator(false)
              }}
            >
              Remove as contributor
            </button>
          ) : (
            <button
              title="Remove this user as a contributor to this parcel."
              disabled={this.state.saving}
              onClick={() => {
                !this.state.saving && this.setCollaborator(true)
              }}
            >
              Add as contributor
            </button>
          ))}
      </div>
    )
  }
}
