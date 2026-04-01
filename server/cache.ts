import { NextFunction, Request, Response } from 'express'

const CACHE_HEADER_KEY = 'Cache-Control'
const STALE = `stale-if-error=1200` // 20 minute grace period for server to come back online
const STALE_REVALIDATE = `stale-while-revalidate=600` // 10 minute grace period for server to revalidate
const DEFAULT_CACHE_PERIOD = 3600
const NO_CACHE = 'no-cache,no-store,must-revalidate'
const DEFAULT_CACHE = process.env.NODE_ENV === 'production' ? `public,max-age=${DEFAULT_CACHE_PERIOD},${STALE},${STALE_REVALIDATE}` : NO_CACHE

const t = {
  ms: 1,
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 3600000 * 24,
  week: 3600000 * 24 * 7,
  month: 3600000 * 24 * 30,
} as const

export type Duration = `${number} ${keyof typeof t | 'm'}${'' | 's'}`

function parseDuration(duration: Duration | number): number {
  const defaultDuration = 3600000

  if (typeof duration === 'number') return duration

  if (typeof duration === 'string') {
    const split = duration.match(/^([\d\.,]+)\s?(\w+)$/)

    if (split && split.length === 3) {
      const len = parseFloat(split[1])
      let unit = split[2].replace(/s$/i, '').toLowerCase()
      if (unit === 'm') {
        unit = 'ms'
      }

      return (len || 1) * (t[unit as keyof typeof t] || 0)
    }
  }

  return defaultDuration
}

export function defaultCache(req: Request, res: Response, next: NextFunction) {
  if (req.method == 'GET') {
    res.set(CACHE_HEADER_KEY, DEFAULT_CACHE)
  } else {
    res.set(CACHE_HEADER_KEY, NO_CACHE)
  }

  next()
}

export function noCache(res: Response) {
  res.set(CACHE_HEADER_KEY, NO_CACHE)
}

export default function cache(duration: Duration | number | 'immutable' | false, allowStale = false) {
  if (duration === 'immutable') {
    const cache = `public,max-age=31536000,immutable,${STALE},${STALE_REVALIDATE}`
    return function (_req: Request, res: Response, next: NextFunction) {
      res.set(CACHE_HEADER_KEY, cache)
      next()
    }
  }

  if (!duration) {
    return function (_req: Request, res: Response, next: NextFunction) {
      res.set(CACHE_HEADER_KEY, NO_CACHE)
      next()
    }
  }

  const dur = parseDuration(duration)
  const cache = `public,max-age=${(dur / 1000).toFixed(0)},${STALE}${allowStale ? ',' + STALE_REVALIDATE : ''}`

  return function (_req: Request, res: Response, next: NextFunction) {
    res.set(CACHE_HEADER_KEY, cache)
    next()
  }
}
