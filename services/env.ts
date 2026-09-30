import dotenv from 'dotenv'

export function loadEnv() {
  const mode = process.env.NODE_ENV || 'development'
  const path = mode === 'production' ? '.env.production' : mode === 'test' ? '.env.test' : '.env'
  const result = dotenv.config({ path })
  // Deployments may supply every setting through their process environment.
  if (result.error && (result.error as NodeJS.ErrnoException).code !== 'ENOENT') throw result.error
}

export function requireSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.JWT_SECRET
  if (!value || value.trim().length < 32) throw new Error('JWT_SECRET must contain at least 32 characters. Generate one with pnpm run setup:env for local development.')
  return value
}
