// ABOUTME: CLI entry for the migrate bundle, run on its own before the server boots.
// ABOUTME: Separate from migrate.ts because require.main is the whole bundle, not this module.

import { loadEnv } from '../../services/env'
loadEnv()
const { runMigrations } = require('./migrate')

runMigrations()
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => process.exit())
