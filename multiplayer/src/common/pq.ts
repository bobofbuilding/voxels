import { Pool, PoolClient, QueryConfig, QueryConfigValues, QueryResult, QueryResultRow } from 'pg'
import { ConnectionOptions } from 'tls'
import { performance } from 'perf_hooks'
import assert from 'assert'
import { createLogger } from '../createLogger'

const log = createLogger('', 'psql')

export type ConnectionHandle = {
  query<R extends QueryResultRow = any, I extends any[] = any[]>(queryConfig: QueryConfig<I>): Promise<QueryResult<R>>
  query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryName: string,
    queryText: string,
    values?: I,
  ): Promise<QueryResult<R>>
  drain(): Promise<void>
}

export function createConnection(appName: string): ConnectionHandle {
  const connectionString = process.env.DATABASE_URL || ''

  let sslSettings: boolean | ConnectionOptions = false
  if (process.env.CA_CERT) {
    sslSettings = {
      rejectUnauthorized: false,
      ca: process.env.CA_CERT,
    }
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    ssl: sslSettings,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  })

  async function query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryConfigOrName: string | QueryConfig<I>,
    queryText?: string,
    values?: I,
  ): Promise<QueryResult<R>> {
    const queryConfig = resolveQueryConfig(appName, queryConfigOrName, queryText ?? null, values ?? null)

    let client: PoolClient
    try {
      client = await pool.connect()
    } catch (err) {
      log.error('pg.Pool connection failure', err)
      throw err
    }

    const startTime = performance.now()

    try {
      const res = await client.query(queryConfig)
      debugLog(startTime, res, queryConfig)
      return res
    } catch (err: unknown) {
      errorLog(startTime, err, queryConfig)
      throw err
    } finally {
      client.release()
    }
  }

  // drain the pool of all active clients, disconnect them, and shut down any internal timers in the pool
  async function drain() {
    await pool.end()
  }

  return {
    query,
    drain,
  }
}

function resolveQueryConfig<Values extends any[]>(
  appName: string,
  queryConfigOrName: string | QueryConfig<Values>,
  queryText: string | null,
  values: Values | null,
): QueryConfig<Values> {
  const queryName: string | undefined =
    typeof queryConfigOrName === 'string' ? queryConfigOrName : queryConfigOrName.name
  const queryConfig: QueryConfig<Values> =
    typeof queryConfigOrName === 'string' ? { text: queryText! } : queryConfigOrName
  assert(queryConfig.text)

  if (values) {
    queryConfig.values = values as QueryConfigValues<Values>
  }

  const queryHeader = `/*
app: ${appName || '(unknown)'}
query: ${queryName || '(unknown)'}
*/
`
  queryConfig.text = queryHeader + queryConfig.text

  return queryConfig
}

function debugLog<I extends any[] = any[]>(startTime: number, res: QueryResult, queryConfig: QueryConfig<I>) {
  log.debug(`(${since(startTime)}sec, ${res.rowCount} rows): ${toLine(queryConfig)}`)
}

function errorLog<I extends any[] = any[]>(startTime: number, err: unknown, queryConfig: QueryConfig<I>) {
  log.error(`(${since(startTime)}sec) '${err?.toString() || '(unknown error)'}': ${toLine(queryConfig)}`)
}

const since = (startTime: number) => ((performance.now() - startTime) / 1000.0).toFixed(2)

// converts a string into a one line string
const toLine = <I extends any[] = any[]>(queryConfig: QueryConfig<I>): string => {
  const sql = queryConfig.text
  try {
    return (
      sql
        // remove Unicode line break characters
        .replace(/[/[\r\n\x0B\x0C\u0085\u2028\u2029]+/g, ' ')
        // remove double whitespaces
        .replace(/\s+/g, ' ')
        .trim()
    )
  } catch (err) {}
  return ''
}
