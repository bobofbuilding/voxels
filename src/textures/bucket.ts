// ABOUTME: Builds URLs for the CDN texture bucket where compressed textures are cached.
// ABOUTME: Uses SHA1 hash of source URL + options to create deterministic bucket paths.

import { simpleHash } from '../../common/helpers/utils'
import { getGpuTextureFormat } from './gpu'
import config from '../../common/config'

/**
 * Build URL for a cached texture in the CDN bucket.
 * The URL is deterministic: same source + options = same bucket path.
 * This is the URL the compressor would upload to after processing.
 */
export const buildCachedTextureUrl = (srcURL: string, transparent: boolean, stretch = false, size?: number | 'passthrough'): string => {
  if (!process.env.TEXTURE_HOST) {
    return srcURL
  }

  const host = process.env.TEXTURE_BUCKET || 'https://textures.sfo2.cdn.digitaloceanspaces.com'

  try {
    srcURL = new URL(srcURL).toString()
  } catch (e) {
    return ''
  }

  const opts = buildHashOptions(size, transparent, stretch, !!srcURL.match('.gif'))
  const hash = hashify(srcURL, opts)

  let url = `${host}/compressed/${hash}_medium${getGpuTextureFormat()}`

  if (config.texture_cachebuster) {
    url += `?version=${config.texture_cachebuster}`
    // Hint must be last so BabylonJS knows to load as compressed texture
    url += `&hint=${getGpuTextureFormat()}`
  }

  return url
}

interface HashOptions {
  size: number
  mode: 'color' | 'transparent'
  stretch: boolean
  gif: 'sheet' // Always 'sheet' for backward compatibility
  passthrough?: boolean
  dontFlipY?: boolean
}

function buildHashOptions(size: number | 'passthrough' | undefined, transparent: boolean, stretch: boolean, isGif: boolean): HashOptions {
  return {
    size: size && size !== 'passthrough' ? size : 0,
    mode: transparent ? 'transparent' : 'color',
    stretch,
    gif: 'sheet',
    passthrough: size === 'passthrough',
    dontFlipY: false,
  }
}

/**
 * Create SHA1 hash from source URL and options.
 * This must match the hash the compressor uses when storing files.
 */
function hashify(srcURL: string, opts: HashOptions): string {
  const hashableOptions = Object.assign({}, opts)

  // Exclude default values from hash for backward compatibility
  if (!hashableOptions.passthrough) {
    delete hashableOptions.passthrough
  }
  if (!hashableOptions.dontFlipY) {
    delete hashableOptions.dontFlipY
  }

  // TODO: previously SHA-1 via Node crypto - CDN paths will differ from old cached textures
  return simpleHash(srcURL + JSON.stringify(hashableOptions))
}
