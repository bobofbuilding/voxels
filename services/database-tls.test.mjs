import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Duplex } from 'node:stream'
import tls from 'node:tls'
import { createRequire } from 'node:module'
const { Client } = createRequire(import.meta.url)('pg')
import { databaseConnectionOptions } from './database-tls.ts'

test('only exact loopback hosts and Unix sockets default to plaintext', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(databaseConnectionOptions({ DATABASE_URL: `postgres://${host}/db` }).ssl, false)
  assert.equal(databaseConnectionOptions({ PGHOST: '/var/run/postgresql' }).ssl, false)
  for (const url of ['postgres://localhost.attacker.test/db', 'postgres://localhost:password@db.example.test/db', 'postgres://db.example.test/db?application_name=localhost', 'postgres://localhost/db?host=db.example.test']) {
    assert.equal(databaseConnectionOptions({ DATABASE_URL: url }).ssl.rejectUnauthorized, true)
  }
  assert.equal(databaseConnectionOptions({ PGHOST: 'db.example.test' }).ssl.rejectUnauthorized, true)
})

test('URL TLS parameters cannot override verified Pool options', () => {
  const result = databaseConnectionOptions({ DATABASE_URL: 'postgresql://db.example.test/db?sslmode=require&ssl=true&uselibpqcompat=true&application_name=worker', CA_CERT: 'private CA' })
  assert.deepEqual(result.ssl, { rejectUnauthorized: true, ca: 'private CA' })
  const url = new URL(result.connectionString)
  assert.equal(url.searchParams.get('application_name'), 'worker')
  for (const key of ['sslmode', 'ssl', 'uselibpqcompat']) assert.equal(url.searchParams.has(key), false)
  assert.equal(databaseConnectionOptions({ DATABASE_URL: 'postgres://db.example.test/db?sslmode=verify-ca' }).ssl.checkServerIdentity, undefined)
})

test('remote plaintext, disabled global TLS, ambiguous hosts and malformed URLs fail closed', () => {
  for (const env of [
    { DATABASE_URL: 'postgres://db.example.test/db', DATABASE_SSL: 'disable' },
    { DATABASE_URL: 'postgres://db.example.test/db?sslmode=disable' },
    { DATABASE_URL: 'postgres://db.example.test/db?sslmode=no-verify' },
    { DATABASE_URL: 'postgres://db.example.test/db?ssl=0' },
    { DATABASE_URL: 'postgres://localhost/db', NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { DATABASE_URL: 'postgres://localhost/db?host=localhost&host=db.example.test' },
    { DATABASE_URL: 'https://db.example.test/db' },
    { DATABASE_URL: 'postgres://secret-user:secret-password@%' },
  ]) {
    assert.throws(
      () => databaseConnectionOptions(env),
      (error) => error instanceof Error && !error.message.includes('secret-password'),
    )
  }
})

test('a local TLS server can be verified with its intended CA; private CA files are retained', () => {
  const dir = mkdtempSync(join(tmpdir(), 'voxels-ca-config-'))
  try {
    const ca = join(dir, 'ca.pem')
    writeFileSync(ca, 'private CA')
    const options = databaseConnectionOptions({ DATABASE_URL: `postgres://localhost/db?sslmode=require&sslrootcert=${encodeURIComponent(ca)}` })
    assert.deepEqual(options.ssl, { rejectUnauthorized: true, ca: 'private CA' })
    assert.equal(new URL(options.connectionString).searchParams.has('sslrootcert'), false)
    assert.deepEqual(databaseConnectionOptions({ DATABASE_SSL: 'enable', CA_CERT: 'private CA' }).ssl, { rejectUnauthorized: true, ca: 'private CA' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// An in-memory pair exercises the actual TLS verifier without network access or
// connecting to an application database. Each certificate is ephemeral test data.
class Peer extends Duplex {
  _read() {}
  _write(chunk, _encoding, callback) {
    this.peer.push(Buffer.from(chunk))
    callback()
  }
}

test('TLS handshake accepts the intended CA and rejects unknown issuers and wrong hostnames', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'voxels-tls-test-'))
  const openssl = (args) => {
    const result = spawnSync('openssl', args, { cwd: dir, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  try {
    openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=Voxels test CA', '-keyout', 'ca.key', '-out', 'ca.pem'])
    openssl(['req', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=db.example.test', '-keyout', 'server.key', '-out', 'server.csr'])
    writeFileSync(join(dir, 'extensions'), 'subjectAltName=DNS:db.example.test\nbasicConstraints=CA:FALSE\n')
    openssl(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-days', '1', '-extfile', 'extensions', '-out', 'server.pem'])
    const ca = readFileSync(join(dir, 'ca.pem'), 'utf8')
    const secureContext = tls.createSecureContext({ key: readFileSync(join(dir, 'server.key')), cert: readFileSync(join(dir, 'server.pem')) })
    const handshake = (hostname, trusted) =>
      new Promise((resolve, reject) => {
        const left = new Peer(),
          right = new Peer()
        left.peer = right
        right.peer = left
        const server = new tls.TLSSocket(right, { isServer: true, secureContext })
        server.on('error', () => {})
        const options = databaseConnectionOptions({ DATABASE_URL: `postgres://${hostname}/db`, ...(trusted ? { CA_CERT: ca } : {}) }).ssl
        const client = tls.connect({ ...options, socket: left, servername: hostname })
        const timer = setTimeout(() => {
          client.destroy()
          server.destroy()
          reject(new Error('TLS handshake timed out'))
        }, 3000)
        const finish = (result) => {
          clearTimeout(timer)
          client.destroy()
          server.destroy()
          resolve(result)
        }
        client.once('secureConnect', () => finish(client.authorized ? 'authorized' : 'unauthorized'))
        client.once('error', (error) => finish(error.code || error.message))
      })
    assert.equal(await handshake('db.example.test', true), 'authorized')
    assert.match(await handshake('db.example.test', false), /CERT|ISSUER|VERIFY/)
    assert.equal(await handshake('wrong.example.test', true), 'ERR_TLS_CERT_ALTNAME_INVALID')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('pg preserves the shared TLS options after parsing a provider connection URL', () => {
  const config = databaseConnectionOptions({ DATABASE_URL: 'postgres://db.example.test/db?sslmode=require&uselibpqcompat=true', CA_CERT: 'private CA' })
  const client = new Client(config)
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true)
  assert.equal(client.connectionParameters.ssl.ca, 'private CA')
  assert.equal(client.connectionParameters.ssl.checkServerIdentity, undefined)
  assert.equal(client.connectionParameters.host, 'db.example.test')
})
