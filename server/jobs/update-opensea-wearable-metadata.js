/*
 * Tell opensea to refetch our token metadata, you should
 * warn them on discord before doing this, it's maybe
 * a bit mean to their servers?
 */

let fetch = require('node-fetch')

require('dotenv')
const { named } = require('../lib/logger')
const log = named('opensea-updater')

const BATCH = 20

let headers = { 'X-API-KEY': process.env.OPENSEA_APIKEY }

async function herpTheDerps() {
  log.info(` * Force updating all wearables metadata, rip opensea`)

  let count = 3095
  let token = 50

  while (token < count) {
    let promises = []

    for (j = 0; j < BATCH; j++) {
      let url = `
        https://api.opensea.io/api/v1/asset/0xa58b5224e2fd94020cb2837231b2b0e4247301a6/${token}/?force_update=true
      `

      url = url.replace(/\s/g, '')
      url = url.replace(/\n/g, '')

      promises.push(await fetch(url, { headers }))

      token++
    }

    log.info(`Force updated ${BATCH}. At offset ${token}.`)

    await Promise.all(promises)
  }

  log.info('Done pwning opensea.')
}

herpTheDerps()
