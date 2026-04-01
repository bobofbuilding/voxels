import UploadParcelVersion from './upload-parcel-version'

export default function ContentUploadDownload({ space, onSuccess }: { space: any; onSuccess?: () => void }) {
  const name = space.spaceId ? 'space' : 'parcel'

  return (
    <ul>
      <li>
        <a onClick={() => downloadJSON(space)}>
          Download <code>{name}</code>
        </a>
      </li>

      <li>
        <label for="upload-btn" htmlFor="upload-btn">
          Upload <code>{name}</code>
        </label>
        <UploadParcelVersion parcel={space} onSuccess={onSuccess} />
      </li>
    </ul>
  )
}

function downloadJSON(parcel: { content: any; id: any; spaceId: string | undefined }) {
  if (!parcel.id && parcel.spaceId) {
    parcel.id = parcel.spaceId
  }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ id: parcel.id, content: parcel.content }))
  let dlLink = document.getElementById('downloadAnchorElem')
  if (!dlLink) {
    dlLink = document.createElement('a')
    dlLink.id = 'downloadAnchorElem'
    dlLink.style.display = 'none'
    document.body.appendChild(dlLink)
  }
  const dlAnchorElem = dlLink
  dlAnchorElem.setAttribute('href', dataStr)
  dlAnchorElem.setAttribute('download', `${parcel.id}-content.json`)
  dlAnchorElem.click()
}
