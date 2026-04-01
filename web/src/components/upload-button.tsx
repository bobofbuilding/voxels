import { useState } from 'preact/hooks'
import { Assetish } from '../asset'
import { app } from '../state'

type UploadResult = {
  success: boolean
  error?: string
  asset?: Assetish
}
type UploadPromise = {
  file: File
  promise: Promise<any>
  result?: UploadResult
}

const uploadAsset = async (file: File): Promise<UploadResult> => {
  const formData = new FormData()
  formData.append('file', file)

  const f = await fetch(`/api/assets/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!f.ok) {
    return { success: false, error: 'Failed to upload asset, please try again' }
  }

  return await f.json()
}

type Props = { collection?: boolean }

export default function UploadButton({ collection }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploads, setUploads] = useState<UploadPromise[]>([])

  const onDone = () => {
    if (uploads.find((u) => u.promise)) {
      return
    }

    window.location.reload()
  }

  const onUpload = (e: HTMLInputElement) => {
    const u = []

    for (const file of e.files ?? []) {
      const promise = uploadAsset(file).then((result) => {
        setUploads(uploads.map((upload) => (upload.file === file ? { ...upload, result } : upload)))

        onDone()
      })

      u.push({ file, promise })
    }

    setUploads(u)
  }

  const userId = app.state.wallet?.toLowerCase()

  return (
    <div class="upload-button">
      <input type="file" name="upload-btn" multiple id="upload-btn" accept=".vox" onChange={(e) => e.target && onUpload(e.target as HTMLInputElement)} />

      <ul>
        {uploads.map((upload) => (
          <li>{upload.result?.success ? <a href={`/users/${userId}/assets/${upload.result.asset!.id}`}>{upload.file.name}</a> : <span>{upload.file.name}...</span>}</li>
        ))}
      </ul>
    </div>
  )
}
