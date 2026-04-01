export enum AssetType {
  Parcel = 'parcels',
  Space = 'spaces',
  Costume = 'costumes',
  Avatar = 'avatars',
  Snapshot = 'snapshot',
  Collectible = 'collectible',
}

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}
const credentials = { credentials: 'include' } as {
  credentials: RequestCredentials
}
const fetchOptions = {
  ...credentials,
  headers,
}

export async function saveAsset(
  type: AssetType | undefined,
  id: number | string,
  content: unknown,
): Promise<{
  success: boolean
  message?: string
}> {
  switch (type) {
    case AssetType.Parcel:
      return await saveParcel(id, content)
    case AssetType.Space:
      return await saveSpace(id, content)
    case AssetType.Avatar:
      return await saveAvatar(content)
    case AssetType.Costume:
      return await saveCostume(id, content)
    case AssetType.Snapshot:
      return await saveSnapshot(content)
    case AssetType.Collectible:
      return await saveWearable(id, content)
  }

  return Promise.resolve({
    success: false,
    message: `type ${type} did not have a saver`,
  })
}

export async function saveSpace(id: any, content: any): Promise<any> {
  const url = `/spaces/${id}`
  return await sendSave(url, content)
}

export async function saveParcel(id: any, content: any): Promise<any> {
  const url = `/grid/parcels/${id}`
  return await sendSave(url, content)
}

export async function saveAvatar(content: any): Promise<any> {
  const url = `/api/avatar`
  return await sendSave(url, content, 'POST')
}

export async function saveCostume(id: any, content: any): Promise<any> {
  const url = `/api/costumes/${id}`
  return await sendSave(url, content, 'PUT')
}

export async function saveSnapshot(content: any): Promise<any> {
  const url = `/api/parcels/snapshot`
  return await sendSave(url, content, 'PUT')
}

export async function saveWearable(id: any, content: any): Promise<any> {
  const url = `/api/collectibles/w/${id}/update`
  return await sendSave(url, content, 'POST')
}

export async function sendSave(url: any, content: any, method = 'PUT'): Promise<any> {
  const options = Object.assign({}, fetchOptions, { method: method })
  const p = await fetch(url, {
    ...options,
    body: JSON.stringify(content),
  })
  return await p.json()
}
