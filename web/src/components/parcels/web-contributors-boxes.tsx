import { Component } from 'preact'

import { app } from '../../state'
import { AssetType } from '../Editable/editable'
import { saveAsset } from '../../helpers/save-helper'
import Panel, { PanelType } from '../panel'
import { resolveName } from '../../auth/login-helper'
import { OwnersOnly } from './permissions'
import ParcelHelper, { ParcelUser, UserRightRole } from '../../../../common/helpers/parcel-helper'
import { SingleParcelRecord } from '../../../../common/messages/parcel'
import { isAddress } from 'ethers'

interface ContributorsBoxesProps {
  parcel?: SingleParcelRecord
  onSave?: (parcelUsers: ParcelUser[]) => void
}

interface ContributorsState {
  parcelUsers: Array<ParcelUser>
  newParcelUsers: ParcelUser | null
  error: string | null
  saving: boolean
}

export default class WebContributorsBoxes extends Component<ContributorsBoxesProps, ContributorsState> {
  constructor(props: ContributorsBoxesProps) {
    super(props)
    this.state = {
      parcelUsers: props.parcel?.parcel_users || [],
      newParcelUsers: null,
      error: null,
      saving: false,
    }
  }

  get parcel() {
    return this.props.parcel
  }

  get helper() {
    if (!this.props.parcel) return null
    return new ParcelHelper(this.props.parcel)
  }

  get isOwner(): boolean {
    if (!app.signedIn) return false
    return this.helper?.isOwner(app.state.wallet) || false
  }

  handleSave(response: { success: boolean }) {
    if (response?.success) {
      this.props.onSave && this.props.onSave(this.state.parcelUsers || [])
      app.showSnackbar('Changes saved!', PanelType.Success)
    } else {
      app.showSnackbar('Could not save changes, try again!', PanelType.Danger)
    }
    this.setState({ saving: false })
  }

  /**
   * Add a contributor to the contributor's list
   */
  addRole = async (info: ParcelUser[]) => {
    this.setState({ saving: true })
    let parcelUsers = Array.from(this.state.parcelUsers)
    parcelUsers = [...parcelUsers, ...info]
    this.setState({ parcelUsers }, async () => {
      const response = await saveAsset(AssetType.Parcel, this.props.parcel!.id, { parcel_users: this.state.parcelUsers })
      this.handleSave(response)
    })
  }

  /**
   * remove a contributor if it exists
   */
  removeContributor = async (value: string) => {
    this.setState({ saving: true })
    const parcelUsers = Array.from(this.state.parcelUsers)
    const oldRole = parcelUsers.find((user) => user.wallet.toLowerCase() === value.toLowerCase())
    oldRole && parcelUsers.splice(parcelUsers.indexOf(oldRole), 1)
    this.setState({ parcelUsers }, async () => {
      const response = await saveAsset(AssetType.Parcel, this.props.parcel!.id, { parcel_users: this.state.parcelUsers })
      this.handleSave(response)
    })
  }

  tryAddWallets = async () => {
    if (!this.state.newParcelUsers) {
      return
    }
    // Catch if user is attempting to add multiple addresses
    const splitted = this.state.newParcelUsers.wallet.split(',')
    const validAddresses: ParcelUser[] = []
    for (const address of splitted) {
      const a = await this.validate(address)

      if (!a) {
        break
      }
      validAddresses.push({ wallet: a, role: 'contributor' })
    }
    if (!validAddresses.length) {
      return
    }
    this.addRole(validAddresses)
    this.setState({ newParcelUsers: null })
  }

  validate = async (value: string | undefined) => {
    let address: string | null
    //Check if value is an address or ETH.
    if (!value || (!isAddress(value) && !(value as any)?.match(/.eth/))) {
      this.setState({ error: 'Address is not valid.' })
      return
    }
    //if value is ENS we reverseLookup to obtain the address
    if (value.match(/.eth/)) {
      address = await resolveName(value)
    } else {
      address = value
    }
    //Check if address is not null
    if (!address) {
      this.setState({ error: 'Address is not valid.' })
      return
    }

    // Check if address is user.
    if (app.state.wallet?.toLowerCase() === address?.toLowerCase()) {
      this.setState({ error: "You can't add yourself as a Contributor" })
      return
    }

    // Check we haven't already recorded that address.
    if (!!this.state.parcelUsers.find((r) => r.wallet.toLowerCase() == address?.toLowerCase())) {
      this.setState({ error: `Address ${address} already exists.` })
      return
    }
    return address
  }

  onEditUserRole = async (userRole: ParcelUser) => {
    this.setState({ saving: true, error: null! })
    const parcelUsers = Array.from(this.state.parcelUsers)
    const old = parcelUsers.find((role) => role.wallet.toLowerCase() === userRole.wallet.toLowerCase())
    if (!old) {
      return
    }
    // set new role
    old.role = userRole.role
    //save new role
    this.setState({ parcelUsers }, async () => {
      const response = await saveAsset(AssetType.Parcel, this.props.parcel!.id, { parcel_users: this.state.parcelUsers })
      this.handleSave(response)
    })
  }

  removeAll = async () => {
    if (!confirm('Remove all parcel users?')) {
      return
    }
    this.setState({ saving: true, error: null! })
    this.setState({ parcelUsers: [] }, async () => {
      const response = await saveAsset(AssetType.Parcel, this.props.parcel!.id, { parcel_users: this.state.parcelUsers })
      this.handleSave(response)
    })
  }

  render() {
    const contributors = this.state.parcelUsers.map((r: ParcelUser) => (
      <ParcelUserRight key={r.wallet} disabled={!this.isOwner || this.state.saving || r.role == 'renter'} onChange={this.onEditUserRole} userRole={r} onRemove={this.removeContributor} />
    ))

    return (
      <div>
        <div>
          <ul>
            {contributors}
            {contributors.length > 1 && (
              <div>
                <button onClick={() => this.removeAll()}>Remove all</button>
              </div>
            )}
            <OwnersOnly parcel={this.parcel}>
              <li key={null}>
                <div>
                  <input
                    type="text"
                    placeholder="Address or Eth name."
                    disabled={!!this.state.saving}
                    value={this.state.newParcelUsers?.wallet || ''}
                    onInput={(e) => this.setState({ newParcelUsers: { wallet: e.currentTarget.value, role: 'contributor' } })}
                  />
                  <button onClick={() => this.tryAddWallets()}>+</button>
                </div>
              </li>
            </OwnersOnly>
          </ul>
        </div>
        {!!this.state.error && <Panel type="danger">{this.state.error}</Panel>}
        {!!this.state.saving && <Panel type="info">Saving...</Panel>}
      </div>
    )
  }
}

interface collaboratorProps {
  userRole: ParcelUser
  onRemove?: Function
  onChange?: (info: ParcelUser) => void
  disabled: boolean /* If it's a collaborator seeing this component we disable it. */
}

interface collaboratorStates {
  name?: string
  wallet: string
  role: UserRightRole
}

class ParcelUserRight extends Component<collaboratorProps, collaboratorStates> {
  element: HTMLElement | null = null

  constructor(props: collaboratorProps) {
    super(props)
    console.log(props.userRole.role)
    this.state = {
      name: null!,
      wallet: props.userRole.wallet,
      role: props.userRole.role || 'contributor',
    }
  }

  /**
   * Returns Object
   */
  get summary() {
    return {
      wallet: this.state.wallet,
      role: this.state.role,
      name: this.state.name,
    }
  }

  get connector() {
    return window.connector
  }

  componentDidMount() {
    this.getName()
  }

  componentDidUpdate() {
    if (this.state.role !== this.props.userRole.role) {
      this.props.onChange && this.props.onChange(this.summary)
    }
  }

  /**
   * Grab the ENS name of that contact
   */
  async getName(cachebust = false, attempt = 0) {
    // .data is the parcel in this case
    const url = `${process.env.API}/avatar/${this.state.wallet}/name.json${cachebust ? `?cb=${Date.now()}` : ''}`

    try {
      const response = await fetch(url)
      const data = await response.json()
      this.setState({ ...data.name })
    } catch (e: any) {
      if (attempt >= 3) {
        console.warn('Failed to get name', e)
        return
      }

      setTimeout(() => {
        attempt++
        this.getName(true, attempt)
      }, 2000)
    }
  }

  /**
   * remove the contact from the list.
   */
  remove = () => {
    this.props.onRemove && this.props.onRemove(this.state.wallet)
  }

  render({}: collaboratorProps, { name, wallet }: collaboratorStates) {
    return (
      <li key={this.state.wallet}>
        <div>
          <div>
            <a href={`/u/${wallet}`}>{name || wallet}</a>
          </div>
          {!this.props.disabled && (
            <div>
              <select value={this.state.role} onChange={(e) => this.setState({ role: e.currentTarget.value as UserRightRole })}>
                <option value="contributor">Contributor</option>
                <option value="owner">Admin</option>
              </select>
            </div>
          )}
          {this.state.role == 'renter' && (
            <div>
              <b>Renter</b>
            </div>
          )}
          {!this.props.disabled && <button onClick={this.remove}>Remove</button>}
        </div>
      </li>
    )
  }
}
