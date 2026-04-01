import { isEqual } from 'lodash'
import { JSX } from 'preact'
import * as strftime from 'strftime'
import { v7 as uuid } from 'uuid'
import { VersionRecord } from '../parcel-versions'
import { fetchOptions } from '../utils'
// @ts-expect-error there's no type definition for this
import diff from 'diff-arrays-of-objects'

export interface Props {
  small?: boolean
  version: VersionRecord
  prior: VersionRecord
  setAsSnapshot: (version: VersionRecord) => void
  createSpaceFromVersion?: (version: VersionRecord) => void

  onRevert(): void
}

export default function EditSummary(props: Props): JSX.Element {
  if (!props.version || !props.prior) {
    return null!
  }
  const createSpaceFromVersion = props.createSpaceFromVersion

  const versionContent = props.version.content || {}
  const priorContent = props.prior.content || {}

  const versionFeatures = versionContent.features || []
  const priorFeatures = priorContent.features || []

  const versionIsSnapshot = !!props.version.is_snapshot

  // key is for preact rendering
  const summary: { key: string; text: string; url?: string }[] = []

  const changes = diff(priorFeatures, versionFeatures, 'uuid', { updatedValues: diff.updatedValues.second })

  changes.added.forEach((add: any) => {
    if (add.type) {
      const object: { key: string; text: string; url?: string } = { text: '', key: uuid() }
      const content = add.text || ''
      if (add.url) {
        object.text = `added ${add.type} ${add.id ? ` [id: ${add.id}]` : ''} with url ${`${add.url}`.slice(0, 60)}...`
        if (add.type == 'image') {
          object.url = add.url
        }
      } else if (content) {
        object.text = `added ${add.type} ${add.id ? ` [id: ${add.id}]` : ''} with content ${`${add.text || ''}`.slice(0, 60)}...`
      } else if (add.type) {
        object.text = `added ${add.type} ${add.id ? ` [id: ${add.id}]` : ''}`
      }
      summary.push(object)
    }
  })

  changes.removed.forEach((del: any) => {
    if (del.type) {
      const object: { key: string; text: string; url?: string } = { text: '', key: uuid() }
      const content = del.text || ''
      if (del.url) {
        object.text = `deleted ${del.type} ${del.id ? ` [id: ${del.id}]` : ''} with url ${`${del.url}`.slice(0, 60)}...`
        if (del.type == 'image') {
          object.url = del.url
        }
      } else if (content) {
        object.text = `deleted ${del.type} ${del.id ? ` [id: ${del.id}]` : ''} with content ${`${del.text || ''}`.slice(0, 60)}...`
      } else if (del.type) {
        object.text = `deleted ${del.type}${del.id ? ` [id: ${del.id}]` : ''} `
      }
      summary.push(object)
    }
  })

  changes.updated.forEach((updated: any) => {
    if (updated.type) {
      const object: { key: string; text: string; url?: string } = { text: '', key: uuid() }
      const content = updated.text || ''
      if (updated.url) {
        object.text = `updated ${updated.type} ${updated.id ? ` [id: ${updated.id}]` : ''} with url ${`${updated.url}`.slice(0, 60)}...`
        if (updated.type == 'image') {
          object.url = updated.url
        }
      } else if (content) {
        object.text = `updated ${updated.type} ${updated.id ? ` [id: ${updated.id}]` : ''} with content ${`${updated.text || ''}`.slice(0, 60)}...`
      } else if (updated.type) {
        object.text = `updated ${updated.type} ${updated.id ? ` [id: ${updated.id}]` : ''}`
      }
      summary.push(object)
    }
  })

  const versionVoxels = versionContent.voxels || ''
  const priorVoxels = priorContent.voxels || ''
  if (versionVoxels !== priorVoxels) {
    summary.push({ key: uuid(), text: 'voxels updated' })
  }

  const versionPalette = Array.from(versionContent.palette || [])
  const priorPalette = Array.from(priorContent.palette || [])
  if (!isEqual(priorPalette.sort(), versionPalette.sort())) {
    summary.push({ key: uuid(), text: 'palette updated' })
  }

  const versionTileset = versionContent.tileset || ''
  const priorTileset = priorContent.tileset || ''
  if (priorTileset !== versionTileset) {
    summary.push({ key: uuid(), text: 'tints updated' })
  }

  if (summary.length === 0) {
    return null!
  }

  const versionDate = strftime('%B %d %Y at %H:%M', new Date(Date.parse(props.version.updated_at)))

  const revert = () => {
    if (confirm(`Are you sure you want to revert to this version?\n\n${versionDate}`)) {
      props.onRevert()
    }
  }

  return (
    <div>
      <hr />
      <div>
        {versionDate} {versionIsSnapshot && <small>[is snapshot]</small>}
      </div>
      <div>
        {!!createSpaceFromVersion && (
          <button onClick={() => createSpaceFromVersion(props.version)} title="Create a free space using this version">
            Create space
          </button>
        )}
        <button onClick={downloadJSON(props)}>Download</button>
        <button onClick={revert}>Revert to</button>
        {!versionIsSnapshot && <button onClick={() => props.setAsSnapshot(props.version)}>Set as Snapshot</button>}
      </div>
      {props.small ? (
        ''
      ) : (
        <ul>
          {summary.map((s) => (
            <li key={s.key}>
              {s.text}
              {s.url && (
                <a href={`${s.url}`} target="_blank">
                  <img src={s.url} width={30} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <small># {props.version.id}</small>
    </div>
  )
}

function downloadJSON(props: Props) {
  return (ev: any) => {
    ev.stopPropagation()
    const v = props.version
    fetch(`${process.env.API}/parcels/${v.parcel_id}/history/${v.id}.json`, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        const versionJSON = r.version

        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(versionJSON))
        let dlLink = document.getElementById('downloadAnchorElem')
        if (!dlLink) {
          dlLink = document.createElement('a')
          dlLink.id = 'downloadAnchorElem'
          dlLink.style.display = 'none'
          document.body.appendChild(dlLink)
        }
        const dlAnchorElem = dlLink
        dlAnchorElem.setAttribute('href', dataStr)
        dlAnchorElem.setAttribute('download', `${v.parcel_id}-${versionJSON.id}.json`)
        dlAnchorElem.click()
      })
  }
}
