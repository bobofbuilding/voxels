const { loadEnv } = require('../services/env')
loadEnv()

// Validate before opening database connections or registering routes.
const { getConfig } = require('./config')
getConfig()
const { currentVersion } = require('../common/version')

// @ts-ignore
global.Bugsnag = require('@bugsnag/js')

if (process.env.BUGSNAG_API_KEY) {
  // @ts-ignore
  global.Bugsnag.start({
    apiKey: process.env.BUGSNAG_API_KEY,
    appVersion: currentVersion,
  })
}

const { runMigrations } = require('./migration/migrate')

void runMigrations()
  .then(() => require('./server'))
  .catch((err: unknown) => {
    console.error('Migrations failed:', err)
    process.exit(1)
  })
