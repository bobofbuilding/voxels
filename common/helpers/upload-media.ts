import { md5 } from './utils'
import { app } from '../../web/src/state'
import config from '../config'
export const MEDIA_UPLOAD_ENDPOINT = config.media_upload_endpoint
export const PROXY_IPFS_ENDPOINT = config.proxy_base_url + '/ipfs/upload'

// AWS does not have folders but this helps set a "folder" in the bucket
// This is so we can better organize the bucket.
type UploadMediaType = 'parcel-content' | /*  default; is the user's wallet folder*/ 'womps' | /* Will be uploaded in wallet/womps/... */ 'assetlibrary'

export const onBeginUpload: BABYLON.Observable<File> = new BABYLON.Observable()
export const onCompleteUpload: BABYLON.Observable<File> = new BABYLON.Observable()
export const onFailUpload: BABYLON.Observable<File> = new BABYLON.Observable()
export type UploadMediaResult =
  | {
      success: true
      location: string
    }
  | {
      success: false
      error: string
    }

type UploadIPFSResult = UploadMediaResult & { hash: string; service_used: string }

export function _arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export const getFileNameNoExtension = (filenameWithExtension: string) => {
  const a = filenameWithExtension.split('.')
  let name = a.splice(0, a.length - 1).join('.')
  if (!/^[\u0000-\u007f]*$/.test(name)) {
    //Chinese characters are non-ascii characters and will fail;
    name = encodeURIComponent(name)
  }
  return name
}
/**
 * Obtain the extension of dataURL Base64; Only valid for images
 * @param dataURI
 * @returns
 */
export const getExtensionFromDatarUrl = (dataURI: string) => {
  if (!dataURI) {
    return 'jpg'
  }
  if (!dataURI.match('image')) {
    return 'jpg'
  }
  return dataURI.split(',')[0].split(':')[1].split(';')[0].split('/')[1]
}

const stableHash = md5

export const generateFileName = async (file: File, mediaType: UploadMediaType = 'parcel-content') => {
  const regex = /(?:\.([^.]+))?$/

  const ext = regex.exec(file.name)
  const arrayBufferStr = _arrayBufferToBase64(await file.arrayBuffer())

  const hashedContent = stableHash(arrayBufferStr) || Date.now()
  // The client should send a hashed file name that contains:
  // - originalFilename (so user quickly knows what the asset is)
  // - wallet of the user
  // - "folder" of where the file goes
  // - type of content (see typeOfMedia above)
  // - hashed content of the file

  const hash = stableHash(app.state.wallet?.toLowerCase() + '/' + mediaType + '/' + hashedContent)
  if (!ext) {
    // We have no extension, this won't cause a problem cause the media server will just reject the request
    return getFileNameNoExtension(file.name) + '_' + hash
  }
  return getFileNameNoExtension(file.name) + '_' + hash + '.' + ext[1]
}

/**
 * For (mega)vox models, use uploadVoxModelMedia() instead, to enforce triangle limits. See the explanation there.
 * @param file
 * @param mediaType
 * @returns
 */
export async function uploadMedia(file: File, mediaType: UploadMediaType = 'parcel-content'): Promise<UploadMediaResult> {
  if (!app.state.key) {
    throw new Error('cant upload missing key')
  }

  onBeginUpload.notifyObservers(file)
  const formData = new FormData()
  const name = await generateFileName(file, mediaType)
  formData.append('media', file, name)

  const headers: Record<string, string> = {
    'x-cryptovoxels-auth': app.state.key,
    'x-file-name': name,
  }

  if (mediaType !== 'parcel-content') headers['x-cryptovoxels-upload-type'] = mediaType

  let result: UploadMediaResult
  try {
    const response = await fetch(MEDIA_UPLOAD_ENDPOINT, {
      mode: 'cors',
      method: 'POST',
      headers: headers,
      body: formData,
    })
    result = await response.json()
  } catch (ex) {
    onFailUpload.notifyObservers(file)
    throw ex
  }

  onCompleteUpload.notifyObservers(file)
  return result
}

export function convertDataURItoJPGFile(dataURI: string, fileName: string = 'image_' + Date.now() + '.jpg'): File {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  const byteString = atob(dataURI.split(',')[1])

  // separate out the mime component
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  // write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length)

  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  // write the ArrayBuffer to a blob, and you're done
  const blob = new File([ia], fileName, { type: mimeString, lastModified: Date.now() })

  console.debug(`input data size: ${dataURI.length} Blob.size: ${blob.size}`)
  return blob
}

export async function uploadMediaToIPFS(file: File): Promise<UploadIPFSResult> {
  const formData = new FormData()

  formData.append('media', file, file.name)
  const response = await fetch(PROXY_IPFS_ENDPOINT, {
    mode: 'cors',
    method: 'POST',
    headers: { 'x-cryptovoxels-auth': app.state.key! },
    body: formData,
  })

  return await response.json()
}

export async function uploadJSONToIPFS(json: Record<string, any>) {
  const f = new File([JSON.stringify(json)], stableHash(JSON.stringify(json)) + '.json', { type: 'text/plain' })
  return await uploadMediaToIPFS(f)
}
