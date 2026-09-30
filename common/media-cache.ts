/** Only public, credential-free media references are eligible for shared storage. */
export function publicMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null
  try {
    const url = new URL(value.startsWith('ugc://') ? 'https://ugc.voxels.com/' + value.slice(6) : value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.pathname.startsWith('/media-cache/') || (url.port && !['80', '443'].includes(url.port))) return null
    if ([...url.searchParams.keys()].some((key) => /token|secret|signature|credential|authorization|password|session|jwt|key|^sig$|^auth$|expires|^x-amz-/i.test(key))) return null
    return url.href
  } catch {
    return null
  }
}
export function parcelMediaUrls(content: unknown): string[] {
  const urls = new Set<string>()
  function walk(value: unknown, depth: number) {
    if (depth > 12 || urls.size >= 2048) return
    if (typeof value === 'string') {
      const url = publicMediaUrl(value)
      if (url) urls.add(url)
    } else if (Array.isArray(value)) value.forEach((item) => walk(item, depth + 1))
    else if (value && typeof value === 'object')
      for (const [key, item] of Object.entries(value)) {
        if (!['script', 'text', 'description', 'link', 'href', 'code'].includes(key)) walk(item, depth + 1)
      }
  }
  walk(content, 0)
  return [...urls]
}
