import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

if (existsSync('.env')) {
  console.log('.env already exists; leaving it unchanged.')
} else {
  const template = readFileSync('.env.example', 'utf8')
  writeFileSync('.env', template.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`), { mode: 0o600, flag: 'wx' })
  console.log('Created .env with a random local signing secret. Configure DATABASE_URL before starting.')
}
