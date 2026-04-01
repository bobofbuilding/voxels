/* globals fetch */

import { isEqual } from 'lodash'
import { Component, ComponentChildren, Fragment } from 'preact'
import { route } from 'preact-router'
import { isValidUrl, ssrFriendlyWindow } from '../../../common/helpers/utils'
import { FullParcelRecord, SingleParcelRecord } from '../../../common/messages/parcel'
import { SpaceRecord } from '../../../common/messages/space'
import { AssetType, saveAsset } from '../helpers/save-helper'
import { CreateEvent } from '../popup-ui/event-manager'
import { toggleNFTGatingManager } from '../popup-ui/nft-gating-manager'
import { app } from '../state'
import { fetchOptions } from '../utils'
import ContentUploadDownload from './content-upload-download'
import SlugEditor from './Editable/edit-slug'
import { PanelType } from './panel'
import { OwnerAndCollaboratorOnly, OwnersOnly } from './parcels/permissions'
import { EffectCallback, useEffect, useRef, useState } from 'preact/hooks'
import { Inputs } from 'preact/compat'

export interface Props {
  parcelOrSpace: FullParcelRecord | SpaceRecord
  onSave?: () => void
  onEventCreate?: (id: number) => void
}

export interface State {
  hostedScripts: boolean
  sandbox?: boolean
  scriptHostUrl?: string
  unlisted?: boolean
  eventing?: boolean
}

const defaultScriptHost = (id: string | number) => `wss://grid.cryptovoxels.com/grid/${id}`

export default class ParcelAdminPanel extends Component<Props, State> {
  constructor(props: Props) {
    super()

    const id = 'spaceId' in props.parcelOrSpace ? props.parcelOrSpace.spaceId : props.parcelOrSpace.id

    this.state = {
      hostedScripts: props.parcelOrSpace?.settings?.hosted_scripts ?? false,
      sandbox: props.parcelOrSpace ? props.parcelOrSpace.settings.sandbox : false,
      unlisted: props.parcelOrSpace && 'unlisted' in props.parcelOrSpace ? props.parcelOrSpace.unlisted : false,
      scriptHostUrl: props.parcelOrSpace?.settings.script_host_url ?? `wss://grid.cryptovoxels.com/grid/${id}`,
    }
  }

  get isSpace() {
    return this.parcelOrSpace && 'spaceId' in this.parcelOrSpace && this.parcelOrSpace.spaceId
  }

  get isParcel() {
    return !this.isSpace
  }

  get id() {
    return this.isSpace ? (this.props.parcelOrSpace as SpaceRecord).spaceId : this.props.parcelOrSpace.id
  }

  get parcelOrSpace(): FullParcelRecord | SpaceRecord {
    return this.props.parcelOrSpace
  }

  componentDidMount() {
    // ?edit_event=1
    const queryString = ssrFriendlyWindow?.location?.search
    if (queryString && this.props.parcelOrSpace) {
      const urlParams = new URLSearchParams(queryString)
      if (urlParams.get('edit_event')) {
        // toggleEventManagerWindow(this.parcelOrSpace as SingleParcelRecord, this.props.onEventCreate, this.props.onSave, this.props.onSave)
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(this.props.parcelOrSpace, prevProps.parcelOrSpace)) {
      this.forceUpdate()
    }
  }

  setStateAsync(state: Partial<State>): Promise<void> {
    return new Promise((resolve) => {
      this.setState(state, resolve)
    })
  }

  async setAndSave(state: Partial<State>) {
    await this.setStateAsync(state)
    await this.save()
  }

  async deleteSpace() {
    if (!this.isSpace) {
      console.error('Tried to delete a space, but this is a parcel')
      return
    }
    const space = this.parcelOrSpace as SpaceRecord
    const body = JSON.stringify({ id: space.id })

    if (confirm(`⚠️ Are you sure you want to remove space ${space.name}? This cannot be undone!`)) {
      const opts = fetchOptions()
      opts.body = body
      opts.method = 'POST'
      opts.headers = {
        ...opts.headers,
        'Content-Type': 'application/json',
      }

      const r = await fetch('/spaces/remove', opts)
      if (!r.ok) {
        app.showSnackbar('❌ Something went wrong... Please try again', PanelType.Danger)
        return
      }
      const data = await r.json()
      if (!data.success) {
        app.showSnackbar('❌ Something went wrong...', PanelType.Danger)
        return
      }
      app.showSnackbar('✔️ Space deleted!', PanelType.Success)

      route(`/`, true)
    }
  }

  async save() {
    const body: { sandbox: boolean; unlisted: boolean; hosted_scripts?: boolean; script_host_url?: string } = {
      sandbox: !!this.state.sandbox,
      unlisted: !!this.state.unlisted,
    }

    if (this.isParcel) {
      body.hosted_scripts = this.state.hostedScripts
      body.script_host_url = this.state.scriptHostUrl
    }
    const p = await saveAsset(this.isSpace ? AssetType.Space : AssetType.Parcel, this.id, body)
    if (!p.success) {
      app.showSnackbar('Something went wrong...', PanelType.Danger)
    } else {
      app.showSnackbar('Settings saved!', PanelType.Success)
      this.props.onSave?.()
    }
  }

  render() {
    // Can use etherscan too
    const transferUrl = `https://opensea.io/assets/ethereum/0x79986af15539de2db9a5086382daeda917a9cf0c/${this.id}/transfer`

    // You can only edit the slug if you set it in the past and its not a UUID (slugs aren't free anymore yo)
    // @ts-ignore
    const slug = this.props.parcelOrSpace.slug && this.props.parcelOrSpace.slug.length != 36

    return (
      <OwnerAndCollaboratorOnly parcel={this.parcelOrSpace}>
        <div>
          <div>
            <h3>Settings</h3>
          </div>
          <section>
            <OwnersOnly parcel={this.parcelOrSpace}>
              <SpacesOnly parcelOrSpace={this.parcelOrSpace}>{slug && <SlugEditor space={this.parcelOrSpace} />}</SpacesOnly>
            </OwnersOnly>

            <ul>
              <ParcelsOnly parcelOrSpace={this.parcelOrSpace}>
                <li>
                  <a onClick={() => this.setState({ eventing: !this.state.eventing })}>Create Event</a>

                  {this.state.eventing && <CreateEvent parcel={this.parcelOrSpace as SingleParcelRecord} />}
                </li>
                <OwnersOnly parcel={this.parcelOrSpace}>
                  <li>
                    <a onClick={() => toggleNFTGatingManager(this.parcelOrSpace as SingleParcelRecord, this.props.onSave)}>NFT Gating</a>
                  </li>
                  <li>
                    <a href={`/parcels/${this.id}/snapshots`}>See snapshots</a>
                  </li>
                  <li>
                    <a href={`/parcels/${this.id}/versions`}>View versions</a>
                  </li>
                  <li>
                    <a href={transferUrl}>Transfer</a>
                  </li>
                </OwnersOnly>
              </ParcelsOnly>
              <li>
                <Sandbox enabled={this.state.sandbox} setAndSave={this.setAndSave.bind(this)} />
              </li>
              <ParcelsOnly parcelOrSpace={this.parcelOrSpace}>
                <li>
                  <HostedScripts hostedScripts={this.state.hostedScripts} scriptHostUrl={this.state.scriptHostUrl} defaultScriptHost={defaultScriptHost(this.id)} setAndSave={this.setAndSave.bind(this)} />
                </li>
              </ParcelsOnly>
              <SpacesOnly parcelOrSpace={this.parcelOrSpace}>
                <li>
                  <Unlisted isUnlisted={this.state.unlisted} setAndSave={this.setAndSave.bind(this)} />{' '}
                </li>
              </SpacesOnly>

              <OwnersOnly parcel={this.parcelOrSpace}>
                <SpacesOnly parcelOrSpace={this.parcelOrSpace}>
                  <ContentUploadDownload space={this.parcelOrSpace} onSuccess={this.props.onSave} />
                  <li>
                    <a onClick={() => this.deleteSpace()}>Delete Space</a>
                  </li>
                </SpacesOnly>
              </OwnersOnly>
            </ul>
          </section>
        </div>
      </OwnerAndCollaboratorOnly>
    )
  }
}

function ParcelsOnly({ parcelOrSpace, children }: { parcelOrSpace: FullParcelRecord | SpaceRecord; children: ComponentChildren }) {
  if (!('spaceId' in parcelOrSpace) || !parcelOrSpace.spaceId) {
    return <Fragment>{children}</Fragment>
  }
  return null
}

function SpacesOnly({ parcelOrSpace, children }: { parcelOrSpace: FullParcelRecord | SpaceRecord; children: ComponentChildren }) {
  if ('spaceId' in parcelOrSpace && parcelOrSpace.spaceId) {
    return <Fragment>{children}</Fragment>
  }
  return null
}

type UnlistedProps = {
  isUnlisted: boolean | undefined
  setAndSave(state: Partial<State>): Promise<void>
}

function Unlisted(props: UnlistedProps) {
  const [unlisted, setUnlisted] = useState(props.isUnlisted ?? false)
  const [isSaving, setIsSaving] = useState(false)
  usePostRenderEffect(() => {
    setIsSaving(true)
    props.setAndSave({ unlisted }).then(() => setIsSaving(false))
  }, [unlisted])

  return (
    <Fragment>
      <input type="checkbox" id="unlisted" onChange={() => setUnlisted((e) => !e)} checked={unlisted} disabled={isSaving} />
      Unlisted
    </Fragment>
  )
}

type SandboxProps = {
  enabled: boolean | undefined
  setAndSave(state: Partial<State>): Promise<void>
}

function Sandbox(props: SandboxProps) {
  const [enabled, setEnabled] = useState(props.enabled ?? false)
  const [isSaving, setIsSaving] = useState(false)

  usePostRenderEffect(() => {
    setIsSaving(true)
    props.setAndSave({ sandbox: enabled }).then(() => setIsSaving(false))
  }, [enabled])

  return (
    <Fragment>
      <input type="checkbox" title="Make sandbox and publicly editable" disabled={isSaving} id="sandbox" onChange={() => setEnabled((enabled) => !enabled)} checked={enabled} />
      <label for="sandbox">Sandbox</label>
    </Fragment>
  )
}

type HostedScriptsProps = {
  hostedScripts: boolean
  scriptHostUrl?: string
  defaultScriptHost: string
  setAndSave(state: Partial<State>): Promise<void>
}

function HostedScripts(props: HostedScriptsProps) {
  const [scriptHostUrl, setScriptHostUrl] = useState(props.scriptHostUrl)
  const [hostedScripts, setHostedScripts] = useState(props.hostedScripts)
  const [isSaving, setIsSaving] = useState(false)

  usePostRenderEffect(() => {
    setIsSaving(true)
    props.setAndSave({ scriptHostUrl, hostedScripts }).then(() => setIsSaving(false))
  }, [hostedScripts])

  const save = () => {
    if (!isValidUrl(scriptHostUrl)) {
      app.showSnackbar('Script host is invalid, reverting...', PanelType.Warning)
      setScriptHostUrl(props.scriptHostUrl)
      return
    }
    setIsSaving(true)
    props.setAndSave({ scriptHostUrl, hostedScripts }).then(() => setIsSaving(false))
  }

  return (
    <Fragment>
      <label for="onGrid">
        <input type="checkbox" title="Activate multiplayer scripts." id="onGrid" disabled={isSaving} onChange={() => setHostedScripts((prevState) => !prevState)} checked={hostedScripts} />
        Hosted Scripts
      </label>
      {hostedScripts && (
        <ul>
          <li>
            <label htmlFor="self_hosted_scripts_input">Host address (optional)</label>
            <input
              value={scriptHostUrl}
              type="text"
              name="self_hosted_scripts_input"
              onInput={(e) => setScriptHostUrl(e.currentTarget.value)}
              onKeyUp={(e) => {
                if (e.key == 'Enter') {
                  e.preventDefault()
                  setScriptHostUrl(e.currentTarget.value)
                  save()
                }
              }}
              id="self_hosted_scripts_input"
              disabled={isSaving}
              placeholder="wss://..."
            />
            <button
              onClick={() => {
                setScriptHostUrl(props.defaultScriptHost)
                save()
              }}
              title="Reset"
            >
              Reset
            </button>
            <button onClick={() => save()}>Save</button>
          </li>
        </ul>
      )}
    </Fragment>
  )
}

// It's like useEffects, but doesn't trigger on the first render change of state
const usePostRenderEffect = (cb: EffectCallback, inputs?: Inputs) => {
  const firstUpdate = useRef(true)
  return useEffect(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false
      return
    }
    cb()
  }, inputs)
}
