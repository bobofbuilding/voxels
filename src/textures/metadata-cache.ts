export interface Metadata {
  url: string
  frames: number
  duration: number
  format: string
}

export function metadataFromResponse(response: Response): Metadata {
  const md = {
    url: response.url, // resolve any eventual redirects from the response
    frames: 1,
    duration: 0,
    format: 'png',
  }
  const frameHeader = response.headers.get('x-frames') || response.headers.get('x-amz-meta-frames')
  if (frameHeader) {
    try {
      const parsed = JSON.parse(frameHeader)
      md.duration = parsed.duration || 3.0
      md.frames = parsed.frames || 1
    } catch (e) {}
  }
  const formatHeader = response.headers.get('x-original-format') || response.headers.get('x-amz-meta-original-format')
  if (formatHeader) {
    try {
      md.format = JSON.parse(formatHeader)
    } catch (e) {}
  }
  return md
}
