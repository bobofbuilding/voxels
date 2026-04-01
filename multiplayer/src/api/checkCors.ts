const allowedOrigins = new Set([
  'https://cryptovoxels.com',
  'http://cryptovoxels.com',
  'https://www.cryptovoxels.com',
  'http://www.cryptovoxels.com',
  'http://cryptovoxels.local:9000',
  'https://uat.cryptovoxels.com',
  'http://localhost:9000',
  'https://voxels.com',
  'http://voxels.com',
  'https://www.voxels.com',
  'http://www.voxels.com',
  'http://voxels.local:9000',
  'https://uat.voxels.com',
])

const allowRegex =
  /\.(crypto)?voxels\.com$|\.crvox\.com$|localhost:\d{4}$|\/\/(crypto)?voxels\.local:\d{4}|voxels\.local$/

// checks the origin of the request and sets the CORS headers
// returns true if the request should continue, false if processing should stop
export default function checkCors(req: import('http').IncomingMessage, res: import('http').ServerResponse): boolean {
  const origin = req.headers['origin']
  const originValue = typeof origin === 'string' ? origin : undefined
  if (!originValue) {
    return true
  } else if (allowedOrigins.has(originValue) || allowRegex.test(originValue)) {
    res.setHeader('Access-Control-Allow-Origin', originValue)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    return true
  } else {
    console.warn('Forbidden request from', originValue)
    res.statusCode = 403
    res.end('Forbidden')
    return false
  }
}
