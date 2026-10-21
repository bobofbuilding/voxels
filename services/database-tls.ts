import { readFileSync } from 'node:fs'
import type { ConnectionOptions } from 'node:tls'

/** One TLS policy for the server, renderer, compiler and multiplayer database clients. */
export function databaseConnectionOptions(env: NodeJS.ProcessEnv = process.env): { connectionString: string; ssl: false | ConnectionOptions } {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('TLS certificate verification must remain enabled')

  let url: URL
  try {
    url = new URL(env.DATABASE_URL || 'postgres://localhost/voxels')
    if (!env.DATABASE_URL) {
      if (env.PGHOST?.startsWith('/')) url.searchParams.set('host', env.PGHOST)
      else if (env.PGHOST) url.hostname = env.PGHOST
      if (env.PGPORT) url.port = env.PGPORT
      if (env.PGDATABASE) url.pathname = '/' + encodeURIComponent(env.PGDATABASE)
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error()
    if (url.searchParams.getAll('host').length > 1) throw new Error()
  } catch {
    // Never include a connection URL (which can contain credentials) in an error.
    throw new Error('DATABASE_URL or PGHOST configuration is invalid')
  }

  let host: string
  try {
    host = url.searchParams.get('host') || decodeURIComponent(url.hostname)
  } catch {
    throw new Error('Database host configuration is invalid')
  }
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host.toLowerCase()) || host.startsWith('/')
  const mode = url.searchParams.get('sslmode') || env.PGSSLMODE
  const flag = url.searchParams.get('ssl')
  const disabled = env.DATABASE_SSL === 'disable' || mode === 'disable' || flag === '0' || flag === 'false'
  if (env.DATABASE_SSL && !['disable', 'enable'].includes(env.DATABASE_SSL)) throw new Error('DATABASE_SSL must be enable or disable')
  if ((!local && disabled) || mode === 'no-verify') throw new Error('Remote databases require verified TLS; configure CA_CERT or DATABASE_CA_CERT for a private CA')

  const ssl: ConnectionOptions = { rejectUnauthorized: true }
  const ca = env.DATABASE_CA_CERT || env.CA_CERT
  if (ca) ssl.ca = ca
  for (const [parameter, key] of [
    ['sslrootcert', 'ca'],
    ['sslcert', 'cert'],
    ['sslkey', 'key'],
  ] as const) {
    const file = url.searchParams.get(parameter)
    if (!file) continue
    try {
      if (key !== 'ca' || !ca) ssl[key] = readFileSync(file, 'utf8')
    } catch {
      throw new Error(`Unable to read database TLS ${parameter} file`)
    }
  }
  const requestedTls = env.DATABASE_SSL === 'enable' || !!mode || flag === 'true' || flag === '1' || !!ssl.ca || !!ssl.cert || !!ssl.key

  // pg parses these after Pool options and can otherwise replace the entire TLS
  // configuration, including hostname verification, with a weaker URL policy.
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('ssl') || key === 'uselibpqcompat') url.searchParams.delete(key)
  }
  return { connectionString: url.toString(), ssl: local && (disabled || !requestedTls) ? false : ssl }
}
