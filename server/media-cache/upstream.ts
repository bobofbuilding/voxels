import { lookup } from 'node:dns/promises'
import http, { IncomingMessage } from 'node:http'
import https from 'node:https'
import { publicMediaUrl } from '../../common/media-cache'

export function publicIPv4(address: string): boolean {
  const p = address.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b, c] = p
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  )
}
export function mediaType(value: string | undefined): string | null {
  const type = (value || '').split(';')[0].trim().toLowerCase()
  if (/^(image\/(png|jpeg|gif|webp|avif|bmp)|audio\/(mpeg|mp4|aac|ogg|wav|x-wav|webm|flac)|video\/(mp4|webm|ogg)|model\/gltf-binary|application\/octet-stream)$/.test(type)) return type
  return null
}
export async function openPublicMedia(input: string, range?: string, signal?: AbortSignal, redirects = 0): Promise<IncomingMessage> {
  const normalized = publicMediaUrl(input)
  if (!normalized || redirects > 4) throw Error('Unsupported public media URL')
  const url = new URL(normalized)
  const addresses = await lookup(url.hostname, { family: 4, all: true })
  if (!addresses.length || addresses.some(({ address }) => !publicIPv4(address))) throw Error('Media must resolve only to public internet addresses')
  // Pin the validated address for this connection; never forward visitor credentials.
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(
      url,
      {
        agent: false,
        signal,
        timeout: 20000,
        headers: { 'User-Agent': 'Voxels-Public-Media-Cache/1', 'Accept-Encoding': 'identity', ...(range ? { Range: range } : {}) },
        lookup: ((_host: string, options: any, callback: any) => (options?.all ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, 4))) as any,
      },
      (incoming) => {
        incoming.on('error', () => {})
        resolve(incoming)
      },
    )
    request.on('error', reject)
    request.on('timeout', () => request.destroy(Error('Media source timed out')))
  })
  if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
    response.destroy()
    if (!response.headers.location) throw Error('Missing media redirect')
    return openPublicMedia(new URL(response.headers.location, url).href, range, signal, redirects + 1)
  }
  return response
}

/** CDN bot-management cookies are discarded; application/session cookies make a source ineligible. */
export function privateCookies(cookies: string[] | undefined): boolean {
  return !!cookies?.some((cookie) => !/^(__cf_bm|_cfuvid)=/.test(cookie))
}
