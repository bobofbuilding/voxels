import { useEffect, useRef, useState } from 'preact/hooks'
import type Parcel from '../../../src/parcel'
import { ParcelVersionValidator } from '../helpers/parcel-version-validator'
import { AssetType, saveAsset } from '../helpers/save-helper'
import { app } from '../state'
import { fetchOptions } from '../utils'
import Panel, { PanelType } from './panel'
import { confirmUpload } from './upload-parcel-version'

type SpaceData = { id: string; validDimensions?: boolean; width: number; depth: number; height: number; name?: string }

export function SpacesToUpload({ parcel, onSuccess }: { parcel: Parcel; onSuccess: () => void }) {
  const [spaces, setSpaces] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const spaceValidator = new ParcelVersionValidator(parcel)
  const divRef = useRef<HTMLDivElement>(null!)

  const fetchSpaces = async () => {
    let p
    try {
      p = await fetch(`${process.env.API}/wallet/${app.state.wallet}/spaces.json`, fetchOptions())
    } catch {}
    if (!p) {
      return
    }
    const r = await p.json()

    // Add a flag to indicate whether space is the same dimensions as the parcel or not;
    r.spaces = r.spaces.map((s: SpaceData) => {
      s.validDimensions = true
      if (s.width !== parcel.x2 - parcel.x1) {
        s.validDimensions = false
      }
      if (s.depth !== parcel.z2 - parcel.z1) {
        s.validDimensions = false
      }
      if (s.height !== parcel.y2 - parcel.y1) {
        s.validDimensions = false
      }
      return s
    })

    setSpaces(r.spaces || [])
  }

  useEffect(() => {
    fetchSpaces()
  }, [])

  const onSelectSpace = (space: SpaceData) => {
    if (!confirm(`Upload Space's content to your parcel?`)) {
      return
    }
    if (loading) {
      app.showSnackbar(`Can't load a space's content while saving another`)
      return
    }
    validateAndSaveContent(space)
  }

  const validateAndSaveContent = async (space: any) => {
    setLoading(true)
    setError(null)

    if (!space.content || !space.content?.voxels) {
      app.showSnackbar('This space has no content to import', PanelType.Info)
      setLoading(false)
      return
    }

    let newVersion
    try {
      // This part ensures the parcel size is valid and that the parcel can be meshed properly.
      // It also removes features outside the parcel featureBounds.
      newVersion = spaceValidator.validate(space)
    } catch (err) {
      console.error(err)
      app.showSnackbar(err as Error, PanelType.Danger)
      setLoading(false)
      return
    }

    if (
      spaceValidator.featuresBeingRemoved.length &&
      !(await confirmUpload(`Some features are outside respectable parcel boundaries and have been removed:\n ${spaceValidator.featuresBeingRemoved.map((p) => p.type).join(', \n ')}. \n Do you want to keep going?`, divRef.current!))
    ) {
      setLoading(false)
      return
    }

    saveVersion(newVersion)
  }

  const saveVersion = async (json: any) => {
    if (!json.id || !json.content) {
      app.showSnackbar(`Parcel content is invalid`, PanelType.Danger)
      return
    }
    let p
    try {
      // save asset
      p = await saveAsset(AssetType.Parcel, parcel.id, { content: json.content })
    } catch (err) {
      console.error(err)
      app.showSnackbar(err as Error, PanelType.Danger)
      setLoading(false)
      return
    }

    if (p.success) {
      app.showSnackbar('Successfully uploaded your new parcel content', PanelType.Success)
      onSuccess()
    } else {
      app.showSnackbar('Could not save your parcel content', PanelType.Danger)
    }
    setLoading(false)
  }

  return (
    <div>
      <p>
        At the moment only spaces of exactly the same dimensions are supported. The dimensions for the current parcel are:{' '}
        <b>
          Width: {parcel.x2 - parcel.x1}; height: {parcel.y2 - parcel.y1}; Depth: {parcel.z2 - parcel.z1}
        </b>
      </p>
      <div ref={divRef}></div>
      <div>
        {!!spaces.length ? (
          spaces.map((s) => <Space space={s} onSelect={onSelectSpace} />)
        ) : (
          <div>
            <b>
              You have no spaces. <a href="/account/spaces">Create a space</a>
            </b>
          </div>
        )}
      </div>
      {!!error && <Panel type={PanelType.Danger}>{error}</Panel>}
    </div>
  )
}

function Space({ space, onSelect }: { space: SpaceData; onSelect: (space: SpaceData) => void }) {
  return (
    <div>
      <div className={`property-item-header -space`} style={{ cursor: 'unset' }}>
        <div style={{ minWidth: '62px' }}>
          <b>Name:</b>
          <br />
          <b>
            <a href={`/spaces/${space.id}`} target="_blank" title="Go to space's page">
              {space.name}
            </a>
          </b>
        </div>

        <div>{space.validDimensions ? <button onClick={() => onSelect(space)}>Import</button> : <button disabled={true}>Invalid dimensions</button>}</div>
      </div>
    </div>
  )
}
