const TinyCache = require('tinycache')
const cache = new TinyCache()

interface Memo {
  json: any
}

class Response {
  private memo: Memo

  constructor(memo: any) {
    this.memo = memo
  }

  async json() {
    return this.memo.json
  }
}

// ttl is in seconds

const DEFAULT_TTL = 60

export function invalidateUrl(url: string) {
  // invalidate all keys matching this url

  if (url.endsWith('*')) {
    const query = url.replace('*', '')

    Object.keys(cache._cache).forEach((key: string) => {
      if (key.startsWith(query)) {
        cache.del(key)
      }
    })

    return
  }

  // Else, invalidate the specific key

  if (cache.get(url)) {
    cache.del(url)
  } else {
    console.warn(`Tried to invalidate url ${url} that is not in the cache`)
  }
}

type Seconds = number

async function cachedFetch(url: string, opts?: RequestInit, ttlSeconds?: Seconds | undefined) {
  if (!opts) {
    opts = {}
  }

  if (opts.cache !== 'reload' && cache.get(url)) {
    // console.log('[hit cache]' + url)

    return new Response(cache.get(url))
  } else {
    // console.log('[missed cache]' + url)
    // console.log(ttl)

    const r = await fetch(url, opts)
    if (!r.ok) {
      throw new Error(`HTTP error! Status: ${r.status}`)
    }

    const memo: Memo = {
      json: await r.json(),
    }

    if (memo.json.success !== true) {
      // throw new Error(`Fetch Error! Success: ${memo.json.success}`)
    }

    if (ttlSeconds && !isFinite(ttlSeconds)) {
      cache.put(url, memo)
    } else {
      cache.put(url, memo, (ttlSeconds || DEFAULT_TTL) * 1000)
    }

    return new Response(cache.get(url))
  }
}

export default cachedFetch
