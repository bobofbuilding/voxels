import { Component, toChildArray } from 'preact'
import ParcelHelper from '../../../../common/helpers/parcel-helper'
import { CollectibleRecord } from '../../../../common/messages/collectibles'

import WearableHelper from '../../helpers/collectible'
import { app, AppEvent } from '../../state'

interface specificUserProps {
  collectible?: CollectibleRecord
  balance?: number // extra optional prop for collectibles, when we want to only allow an owner
  parcel?: {
    owner: string | undefined
    contributors?: string[]
  }
}

export class PermissionComponent extends Component<specificUserProps, any> {
  onAppSignInSignOut = () => {
    // causes a re-render
    this.setState({ signedIn: app.signedIn })
  }

  componentDidMount() {
    app.on(AppEvent.Logout, this.onAppSignInSignOut)
    app.on(AppEvent.Login, this.onAppSignInSignOut)
  }

  componentWillUnmount() {
    app.removeListener(AppEvent.Logout, this.onAppSignInSignOut)
    app.removeListener(AppEvent.Login, this.onAppSignInSignOut)
  }

  componentDidUpdate(prevProps: any) {
    if (this.props.parcel != prevProps.parcel) {
      this.forceUpdate()
    }
    if (this.props.collectible != prevProps.collectible) {
      this.forceUpdate()
    }
  }

  isUserMod = (): boolean => {
    if (!app.signedIn) {
      return false
    }
    return !!app.state.moderator
  }

  render() {
    if (!app.signedIn) {
      return <div></div>
    }
    return this.props.children as any
  }
}

export class SignedInOnly extends PermissionComponent {
  render() {
    if (!app.signedIn) {
      return <div></div>
    }
    return this.props.children as any
  }
}

// This will show the children only if user is the blockchain owner of the parcel
export class ChainOwnerOnly extends PermissionComponent {
  get isChainOwner() {
    if (!app.signedIn) {
      return false
    }
    if (!this.props.parcel) {
      return false
    }

    return this.props.parcel.owner?.toLowerCase() == app.state.wallet?.toLowerCase()
  }

  render() {
    if (!this.isChainOwner) {
      return <div></div>
    }
    return this.props.children as any
  }
}

export class OwnersOnly extends PermissionComponent {
  get isOwner() {
    if (!app.signedIn) {
      return false
    }
    if (!this.props.parcel) {
      return false
    }

    const helper = new ParcelHelper(this.props.parcel)
    return !!helper.isOwner(app.state.wallet)
  }

  render() {
    if (!this.isOwner) {
      return <div></div>
    }
    return this.props.children as any
  }
}

export class CollaboratorOnly extends PermissionComponent {
  get isCollaborator() {
    if (!app.signedIn) {
      return false
    }
    if (!this.props.parcel) {
      return false
    }
    const helper = new ParcelHelper(this.props.parcel)
    return !!helper.isContributor(app.state.wallet)
  }

  render() {
    if (!this.isCollaborator) {
      return <div></div>
    }
    return <div>{toChildArray(this.props.children)[0]}</div>
  }
}

export class OwnerAndCollaboratorOnly extends PermissionComponent {
  get isOwner() {
    if (!app.signedIn) {
      return false
    }
    if (!this.props.parcel) {
      return false
    }
    const helper = new ParcelHelper(this.props.parcel)
    return !!helper.isOwner(app.state.wallet)
  }

  get isCollaborator() {
    if (!app.signedIn) {
      return false
    }
    if (!this.props.parcel) {
      return false
    }
    const helper = new ParcelHelper(this.props.parcel)
    return !!helper.isContributor(app.state.wallet)
  }

  render() {
    if (!this.isCollaborator && !this.isOwner) {
      return <div></div>
    }
    return this.props.children as any
  }
}

export class OwnerAndCollaboratorAndModsOnly extends OwnerAndCollaboratorOnly {
  render() {
    if (!this.isCollaborator && !this.isOwner && !app.state.moderator) {
      return <div></div>
    }
    return this.props.children as any
  }
}

export class CollectibleAuthorOnly extends PermissionComponent {
  get collectibleHelper() {
    return new WearableHelper(this.props.collectible!)
  }

  render() {
    if (!this.collectibleHelper.isAuthor(app.state.wallet)) {
      return <div></div>
    }
    return this.props.children as any
  }
}

export class CollectionOwnerOrModOnly extends PermissionComponent {
  constructor() {
    super()
  }

  get collectibleHelper() {
    return new WearableHelper(this.props.collectible!)
  }

  render() {
    if (!this.isUserMod() && !this.state.isCollectionOwner) {
      return <div></div>
    }
    return this.props.children
  }
}

export class CollectionOwnerOrModOrCollectibleAuthorOnly extends CollectionOwnerOrModOnly {
  render() {
    if (!this.isUserMod() && !this.state.isCollectionOwner && !this.collectibleHelper.isAuthor(app.state.wallet) && this.props.balance == 0) {
      return <div></div>
    }
    return this.props.children
  }
}
