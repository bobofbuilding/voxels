import * as ethers from 'ethers'
import { Fragment } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { format } from 'timeago.js'
import { fetchUsersCollectibles } from '../../../../common/helpers/collections-helpers'
import { copyTextToClipboard } from '../../../../common/helpers/utils'
import { ApiAvatar } from '../../../../common/messages/api-avatars'
import cachedFetch from '../../helpers/cached-fetch'
import { AssetType } from '../../helpers/save-helper'
import { app } from '../../state'
import { fetchAPI, fetchOptions } from '../../utils'
import EditableDescription from '../Editable/editable-description'
import { PanelType } from '../panel'
import { EditSocialLink, SocialLink } from './socials'
// import AvatarCanvas from '../../../../src/ui/costumers/avatar-canvas'
import { ethTrunc } from '../../../../common/utils'
import { Contributor } from '../../../account/contributor'
import { Parcels } from '../../../account/parcels'
import { Spaces } from '../../../account/spaces'
import { Spinner } from '../../spinner'
import WompsList from '../../womps-list'
// import Collectibles from '../../../account/collectibles'

type Props = {
  walletOrUUId: string | undefined
  tab?: string
  isOwner?: boolean
}

type EditProps = { small?: boolean; value: string; onChange: (value: string) => Promise<void>; onValidate?: (value: string) => Promise<true | string> }

enum EditState {
  Viewing,
  Editing,
  Validating,
  Saving,
}

function PlaceEdit(props: EditProps) {
  const [state, setState] = useState(EditState.Viewing)
  const [value, setValue] = useState(props.value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(props.value)
  }, [props.value])

  const onClick = () => {
    setState(EditState.Editing)

    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const onSubmit = async (e: Event) => {
    e.preventDefault()

    if (props.onValidate) {
      setState(EditState.Validating)

      const validation = await props.onValidate(value)

      if (validation !== true) {
        setState(EditState.Editing)
        alert(validation)

        return
      }
    }

    setState(EditState.Saving)

    try {
      await props.onChange(value)
    } catch (e: any) {
      alert(e.toString())
      setState(EditState.Editing)
      return
    }

    setState(EditState.Viewing)
  }

  const onCancel = () => {
    setState(EditState.Viewing)
  }

  if (state === EditState.Editing) {
    return (
      <form class="place-edit" onSubmit={onSubmit}>
        <input ref={inputRef} type="text" value={value} onInput={(e) => setValue(e.currentTarget.value)} />
        <br />
        <button>Save</button> or{' '}
        <a onClick={onCancel} href="#">
          Cancel
        </a>
      </form>
    )
  } else if (state === EditState.Saving || state === EditState.Validating) {
    return (
      <p>
        <Spinner />
      </p>
    )
  } else {
    return (
      <h3>
        <span onClick={onClick} class="editable">
          {props.value}
        </span>
      </h3>
    )
  }
}

export default function Profile(props: Props) {
  const [avatar, setAvatar] = useState<ApiAvatar | undefined>(undefined)
  const [collabs, setCollabs] = useState(0)
  const [wearables, setWearables] = useState(0)
  const [womps, setWomps] = useState(0)
  const { walletOrUUId } = props

  useEffect(() => fetch(), [walletOrUUId])

  const handledGetAddress = (wallet: string | undefined) => {
    if (!wallet) return undefined
    try {
      return ethers.getAddress(wallet)
    } catch {
      return undefined
    }
  }

  const fetch = () => {
    fetchAPI(`/api/avatars/${walletOrUUId}.json`).then((data) => {
      console.log('data', data)
      setAvatar(data.avatar)
    })

    fetchUsersCollectibles(walletOrUUId).then((results) => setWearables(results.length))
    cachedFetch(`/api/womps/by/${walletOrUUId}`)
      .then((r) => r.json())
      .then((data) => setWomps(data.womps?.length ?? 0))
    cachedFetch(`/api/wallet/${walletOrUUId}/contributing-parcels.json`)
      .then((r) => r.json())
      .then((data) => setCollabs(data?.parcels?.length ?? 0))
  }

  // cache busting avatar fetching
  const fetchAvatar = () => fetchAPI(`/api/avatars/${walletOrUUId}.json?cb=${Date.now()}`).then((data) => setAvatar(data.avatar))

  const walletAddress = handledGetAddress(walletOrUUId) ?? '0x0000000000000000000000000000000000000000'
  const copyWalletToClipboard = () => {
    walletAddress &&
      copyTextToClipboard(
        walletAddress,
        () => app.showSnackbar(`Copied wallet address to clipboard ${walletOrUUId}`, PanelType.Success),
        () => app.showSnackbar(`Could not copy wallet`, PanelType.Info),
      )
  }

  let aka: string[] = []
  if (Array.isArray(avatar?.names)) {
    aka = avatar?.names.filter((v) => v !== avatar?.name) as string[]
    const num = aka.length
    aka = aka?.slice(0, 5)
    const others = num - 5
    if (others > 0) {
      aka.push(`and ${others} others`)
    }
  }

  const descriptionValidator = (value: string) => {
    if (!value) return true
    if (value.length > 500) {
      app.showSnackbar('Description is more than 500 characters', PanelType.Danger)
      return false
    }
    return true
  }

  const owner = props.isOwner
  const name = avatar?.name ?? (props.walletOrUUId ? ethTrunc(props.walletOrUUId!) : 'anon')

  let tab = 'parcels'
  if (props.tab) tab = props.tab

  const changeName = async (name: string) => {
    const r = await fetchAPI('/api/avatar', fetchOptions(undefined, JSON.stringify({ name })))

    if (!r.success) {
      throw new Error(r.message)
    }

    fetchAvatar()
  }

  const validateName = async (name: string): Promise<true | string> => {
    if (!name) {
      return 'Name is required'
    }

    if (name.length > 50) {
      return 'Name is more than 50 characters'
    }

    if (name === '') {
      return 'Name cannot be empty'
    }

    if (name === 'anon') {
      return 'Name anon is reserved'
    }
    // const r = await fetchAPI(`/api/avatars/${wallet}/name/${name}.json`)
    // const { avatar } = await r.json()

    // if (avatar) {
    //   return 'Name is already taken'
    // }

    return true
  }

  // <AvatarCanvas wallet={wallet!} avatar={avatar} dance="Walk" frame="profile" />

  return (
    <section class="columns profile">
      <hgroup style={{ flexGrow: 1 }}>
        <h1>{props.isOwner ? 'Account' : name}</h1>
        {avatar?.last_online && <p>Last seen {avatar?.last_online ? format(avatar?.last_online) : '–'}.</p>}
      </hgroup>

      <article>
        <h3>Womps</h3>
        <WompsList hint={'You have no womps! Take a womp in world (using shortcut P)'} numberToShow={20} collapsed={false} ttl={60} fetch={`/womps/by/${props.walletOrUUId}`} />
      </article>

      <aside>
        <h3>Parcels</h3>

        <Parcels wallet={props.walletOrUUId} isOwner={props.isOwner} />

        <h3>Collaborations</h3>

        <Contributor wallet={props.walletOrUUId} isOwner={props.isOwner} />

        <h3>Spaces</h3>
        <Spaces wallet={props.walletOrUUId} isOwner={props.isOwner} />
        {props.isOwner && (
          <>
            <h3>Name</h3>
            <small>
              <label>(Click to edit)</label>
            </small>
            <PlaceEdit value={name} onValidate={validateName} onChange={changeName} />
          </>
        )}
        <h3>Description</h3>

        <div>
          <EditableDescription value={avatar?.description ?? null} isowner={owner} validationRule={descriptionValidator} type={AssetType.Avatar} data={avatar} title="Description of your avatar" />
        </div>

        <dl>
          <dt>Wallet</dt>
          <dd>
            <a onClick={copyWalletToClipboard} title="Click to copy wallet address to clipboard">
              {ethTrunc(walletAddress)}
            </a>
            <br />
            <a href={`https://etherscan.io/address/${walletAddress}`} title="View on etherscan.io">
              Etherscan
            </a>
            <br />
            {!handledGetAddress(walletOrUUId) && <small>Id: {walletOrUUId}</small>}
          </dd>

          {avatar?.moderator && (
            <Fragment>
              <dt>Role</dt>
              <dd>Moderator</dd>
            </Fragment>
          )}
          <dt>Wearables</dt>
          <dd>{props.isOwner ? <a href="/account/collectibles">{wearables}</a> : wearables}</dd>
          <dt>Link</dt>
          <dd>
            {!owner && <SocialLink socialUrl={avatar?.social_link_1 ?? ''} maxLength={48} />}
            {owner && <EditSocialLink socialLinkNumber={1} avatar={avatar} onSave={fetchAvatar} />}
          </dd>
          <dt>Link</dt>
          <dd>
            {!owner && <SocialLink socialUrl={avatar?.social_link_2 ?? ''} maxLength={48} />}
            {owner && <EditSocialLink socialLinkNumber={2} avatar={avatar} onSave={fetchAvatar} />}
          </dd>
          <dt>Last seen</dt>
          <dd>{avatar?.last_online ? format(avatar?.last_online) : '–'}</dd>
          <dt>Joined</dt>
          <dd>{avatar?.created_at ? format(avatar.created_at) : 'The mists of time'}</dd>
        </dl>
      </aside>
    </section>
  )
}
