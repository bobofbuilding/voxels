import { Collection, CollectionHelper } from '../../../../common/helpers/collections-helpers'
import { ssrFriendlyDocument } from '../../../../common/helpers/utils'
import { app } from '../../state'

export function CollectionTabsNavigation(props: { collection: Collection }) {
  const { collection } = props

  if (!collection) {
    return (
      <ul>
        <li>
          <a href={`/collections`}>{'<'} Go back</a>
        </li>
      </ul>
    )
  }
  const chainid = new CollectionHelper(collection).chainIdentifier
  const address = collection.address
  const path = ssrFriendlyDocument?.location?.pathname
  const isBrowse = path === `/collections/${chainid}/${address}`
  const isAdmin = path === `/collections/${chainid}/${address}/tab/admin`
  const isUpload = path === `/collections/${chainid}/${address}/tab/upload`
  const isOwner = app.signedIn && app.state.wallet?.toLowerCase() == collection.owner?.toLowerCase()
  const isMod = app.signedIn && !!app.state.moderator
  const isVisibleToUser = !collection.suppressed || isMod || isOwner
  const settings = collection.settings

  return (
    <dl>
      <dt>Collectibles</dt>
      <dd>
        <a href={`/collections/${chainid}/${address}`}>Browse collectibles</a>{' '}
      </dd>
      {settings?.website && (
        <>
          <dt>Website</dt>
          <dd>
            <a href={settings?.website}>{settings?.website.match(/opensea/g) ? 'OpenSea' : 'Website'}</a>
          </dd>
        </>
      )}
      {settings?.virtualStore && (
        <>
          <dt>Store</dt>
          <dd>
            <a href={'/parcels/' + settings.virtualStore}>Parcel#{settings.virtualStore}</a>
          </dd>
        </>
      )}
      {(isMod || !collection.discontinued) && (isOwner || isMod) && (
        <>
          <dt>Admin</dt>
          <dd>
            <a href={`/collections/${chainid}/${address}/tab/admin`}>Admin</a>
          </dd>
        </>
      )}
      {app.signedIn && (isOwner || isMod || !!settings?.canPublicSubmit) && !collection.discontinued && (
        <>
          <dt>Mint</dt>
          <dd>
            <a href={`/collections/${chainid}/${address}/tab/upload`}>Mint</a>
          </dd>
        </>
      )}
    </dl>
  )
}
