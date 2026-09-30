#!/usr/bin/env node
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { randomBytes, createHash, generateKeyPairSync } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const options = {
  directory: { type: 'string', default: path.join(repository, '.voxels-node') },
  owner: { type: 'string' },
  'public-origin': { type: 'string', default: 'http://localhost:8787' },
  port: { type: 'string', default: '8787' },
  network: { type: 'string' },
  world: { type: 'string' },
  peer: { type: 'string', multiple: true },
  'allow-local-http': { type: 'boolean' },
  inventory: { type: 'string' },
  'expected-parcels': { type: 'string', default: '8807' },
  starter: { type: 'boolean' },
  help: { type: 'boolean' },
}
export function validate(values) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(values.owner || '') || /^0x0{40}$/i.test(values.owner)) throw Error('Supply --owner with the nonzero Ethereum wallet that administers this world.')
  if (!!values.starter === !!values.inventory) throw Error('Choose exactly one: --starter or --inventory /absolute/path.')
  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('--port must be an integer from 1024 to 65535.')
  const origin = new URL(values['public-origin'])
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || !['https:', 'http:'].includes(origin.protocol))
    throw Error('Use an origin such as https://world.example.org, without a path or credentials.')
  if (origin.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw Error('Public nodes require an HTTPS origin.')
  const expected = Number(values['expected-parcels'])
  if (!Number.isInteger(expected) || expected < 1) throw Error('--expected-parcels must be a positive integer.')
  const world =
    values.world ||
    '0x' +
      createHash('sha256')
        .update('voxels-starter-v1:' + values.owner.toLowerCase())
        .digest('hex')
  if (!/^0x[a-f0-9]{64}$/.test(world)) throw Error('--world must be a 0x-prefixed 32-byte world identifier.')
  if (values.inventory && !values.world) throw Error('Inventory nodes require --world with the shared network identifier.')
  const peers = (values.peer || []).map((value) => {
    const url = new URL(value)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) throw Error('Peer must be an HTTP(S) origin')
    if (url.protocol === 'http:' && !values['allow-local-http']) throw Error('Peer requires HTTPS; local test networks may use --allow-local-http')
    return url.origin
  })
  if (peers.length > 16) throw Error('At most 16 peers are supported')
  return {
    world,
    peers,
    allowLocalHTTP: !!values['allow-local-http'],
    owner: values.owner.toLowerCase(),
    origin: origin.origin,
    port,
    expected,
    inventory: values.inventory ? path.resolve(values.inventory) : null,
    mode: values.starter ? 'starter' : 'inventory',
  }
}
export function compose(config, directory, repo = repository) {
  const appEnv = path.join(directory, 'app.env')
  const image = `voxels-node:${config.build}`
  const base = { image, env_file: [appEnv], restart: 'unless-stopped', init: true, security_opt: ['no-new-privileges:true'], cap_drop: ['ALL'], tmpfs: ['/tmp:size=128m'], mem_limit: '1536m' }
  const healthy = { condition: 'service_healthy' }
  const db = { condition: 'service_completed_successfully' }
  const check = (url) => ({ test: ['CMD', 'node', '-e', `fetch('${url}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`], interval: '10s', timeout: '5s', retries: 12, start_period: '30s' })
  return {
    name: `voxels-${createHash('sha256').update(directory).digest('hex').slice(0, 10)}`,
    services: {
      database: {
        image: 'postgres:18.6-bookworm',
        env_file: [path.join(directory, 'database.env')],
        restart: 'unless-stopped',
        volumes: [{ type: 'bind', source: path.join(directory, 'database'), target: '/var/lib/postgresql' }],
        healthcheck: { test: ['CMD-SHELL', 'pg_isready -U voxels -d voxels'], interval: '5s', timeout: '5s', retries: 30 },
        mem_limit: '1g',
      },
      redis: {
        image: 'redis:8.2-bookworm',
        restart: 'unless-stopped',
        command: ['redis-server', '--save', '', '--appendonly', 'no', '--maxmemory', '128mb', '--maxmemory-policy', 'allkeys-lru'],
        healthcheck: { test: ['CMD', 'redis-cli', 'ping'], interval: '5s', timeout: '3s', retries: 12 },
        mem_limit: '256m',
      },
      bootstrap: {
        ...base,
        restart: 'no',
        build: { context: repo, dockerfile: 'selfhost/node/Dockerfile', args: { BUILD_NUM: config.build, OWNER_ADDRESS: config.owner, FEDERATION_WORLD: config.world } },
        command: ['node', 'selfhost/node/bootstrap-bundle.mjs'],
        depends_on: { database: healthy },
        volumes: config.inventory ? [{ type: 'bind', source: config.inventory, target: '/inventory', read_only: true }] : [],
      },
      world: { ...base, command: ['node', 'server/bundle_server.js'], environment: { PORT: '19000' }, depends_on: { bootstrap: db, redis: healthy }, healthcheck: check('http://127.0.0.1:19000/api/ping') },
      multiplayer: { ...base, command: ['node', 'dist/mp.js'], environment: { PORT: '13780' }, depends_on: { world: healthy }, healthcheck: check('http://127.0.0.1:13780/ping'), mem_limit: '512m' },
      gateway: {
        ...base,
        command: ['node', 'selfhost/seed/gateway.mjs'],
        environment: { GATEWAY_BIND: '0.0.0.0', WORLD_HOST: 'world', MULTIPLAYER_HOST: 'multiplayer', PUBLIC_HOST: new URL(config.origin).host, PUBLIC_ORIGIN: config.origin },
        ports: [`127.0.0.1:${config.port}:8787`],
        depends_on: { world: healthy, multiplayer: healthy },
        healthcheck: check('http://127.0.0.1:8787/health'),
        mem_limit: '256m',
      },
    },
  }
}
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw Error(`Cannot run ${command}: ${result.error.message}`)
  if (result.status !== 0) throw Error(`${command} failed (exit ${result.status}). Existing data has been retained.`)
}
export async function initialize(values) {
  if (values.network) {
    if (values.starter || !values.inventory) throw Error('--network requires a verified --inventory, not --starter')
    const network = JSON.parse(await readFile(path.resolve(values.network), 'utf8'))
    if (network.version !== 1 || !Array.isArray(network.peers) || !/^[a-f0-9]{64}$/.test(network.islandsSha256)) throw Error('Unsupported network reference')
    if ((values.owner && values.owner.toLowerCase() !== network.editor.toLowerCase()) || (values.world && values.world !== network.world)) throw Error('Explicit identity differs from the network reference')
    const islands = await readFile(path.join(path.resolve(values.inventory), 'islands.json'))
    if (createHash('sha256').update(islands).digest('hex') !== network.islandsSha256) throw Error('Island data differs from the pinned network reference')
    values = { ...values, owner: network.editor, world: network.world, peer: [...network.peers, ...(values.peer || [])], 'expected-parcels': String(network.expectedParcels) }
  }
  const directory = path.resolve(values.directory)
  const config = { ...validate(values), build: randomBytes(8).toString('hex'), format: 1 }
  if (config.inventory) {
    await access(path.join(config.inventory, 'builds'))
    await access(path.join(config.inventory, 'islands.json'))
  }
  // Exclusive directory creation avoids secret rotation or silently adopting old data.
  await mkdir(directory, { mode: 0o700 })
  await mkdir(path.join(directory, 'database'), { mode: 0o700 })
  const keys = generateKeyPairSync('ed25519')
  const privateKey = keys.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')
  config.node = createHash('sha256')
    .update(keys.publicKey.export({ format: 'der', type: 'spki' }))
    .digest('hex')
  const password = randomBytes(32).toString('hex')
  const jwt = randomBytes(32).toString('hex')
  const env = {
    FEDERATION_WORLD: config.world,
    FEDERATION_NODE: config.node,
    FEDERATION_PRIVATE_KEY: privateKey,
    FEDERATION_PEERS: config.peers.join(','),
    FEDERATION_ALLOW_LOCAL_HTTP: String(config.allowLocalHTTP),
    DATABASE_SSL: 'disable',
    NODE_ENV: 'production',
    BIND_HOST: '0.0.0.0',
    DATABASE_URL: `postgresql://voxels:${password}@database:5432/voxels`,
    JWT_SECRET: jwt,
    OWNER_ADDRESS: config.owner,
    CONTRACT_ADDRESS: '0x79986aF15539de2db9A5086382daEdA917A9CF0C',
    PUBLIC_URL: new URL(config.origin).host,
    API: '/api',
    ASSET_PATH: '',
    BUILD_NUM: config.build,
    REDIS_URL: 'redis://redis:6379',
    RUN_BACKGROUND_JOBS: 'false',
    PARCEL_EDIT_POLICY: 'admin',
    DATABASE_STATEMENT_TIMEOUT_MS: '5000',
    BOOTSTRAP_MODE: config.mode,
    EXPECTED_PARCELS: String(config.expected),
  }
  const save = (name, content) => writeFile(path.join(directory, name), content, { flag: 'wx', mode: 0o600 })
  await save('database.env', `POSTGRES_USER=voxels\nPOSTGRES_DB=voxels\nPOSTGRES_PASSWORD=${password}\n`)
  await save(
    'app.env',
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
  )
  await save('node.json', JSON.stringify(config, null, 2) + '\n')
  await save('compose.json', JSON.stringify(compose(config, directory), null, 2) + '\n')
  return directory
}
export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, options, allowPositionals: true })
  const [command = 'help'] = positionals
  if (values.help || command === 'help') {
    console.log(
      'Voxels node setup (Node 24+, Docker Compose, 64-bit Linux/macOS)\n\ninit --owner 0x... (--starter | --inventory PATH) [--public-origin https://world.example.org]\nup | status | down | doctor\n\nShared-world options: --network PATH (trusted network JSON), or --world 0x... --peer https://node.example.org (repeatable).\nAll commands accept --directory PATH (default .voxels-node).\nNo firewall, DNS, paid services or existing database are changed.\nSee selfhost/node/README.md and AI_SETUP.md before joining a shared world.',
    )
    return
  }
  const directory = path.resolve(values.directory)
  if (command === 'init') {
    await initialize(values)
    console.log(`Created private node configuration in ${directory}. Run setup.mjs up --directory ${JSON.stringify(directory)}.`)
    return
  }
  if (!['up', 'down', 'status', 'doctor'].includes(command)) throw Error('Unknown command; use --help.')
  run('docker', ['compose', 'version'])
  run('docker', ['info', '--format', '{{.OSType}}/{{.Architecture}}'])
  if (command === 'doctor') return
  const config = JSON.parse(await readFile(path.join(directory, 'node.json'), 'utf8'))
  if (config.format !== 1) throw Error('Unsupported node configuration version.')
  const prefix = ['compose', '--project-directory', directory, '--file', path.join(directory, 'compose.json')]
  if (command === 'up') {
    // A fresh asset version prevents browsers retaining old bundles after an upgrade.
    config.build = randomBytes(8).toString('hex')
    const envPath = path.join(directory, 'app.env')
    const env = (await readFile(envPath, 'utf8')).replace(/^BUILD_NUM=.*$/m, `BUILD_NUM=${config.build}`)
    await writeFile(envPath, env, { mode: 0o600 })
    await writeFile(path.join(directory, 'node.json'), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 })
    await writeFile(path.join(directory, 'compose.json'), JSON.stringify(compose(config, directory), null, 2) + '\n', { mode: 0o600 })
    run('docker', [...prefix, 'build', 'bootstrap'])
    run('docker', [...prefix, 'up', '--detach', '--wait', '--wait-timeout', '300'])
    console.log(`Node ready at http://localhost:${config.port}/play. Public origin: ${config.origin}.`)
  } else if (command === 'down') run('docker', [...prefix, 'down'])
  else run('docker', [...prefix, 'ps'])
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
