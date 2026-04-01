const POAP_API_KEY = process.env.POAP_API_KEY || ''
const POAP_SECRET_KEY = process.env.POAP_SECRET_KEY || ''
const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-API-Key': POAP_API_KEY,
} as Record<string, any>

/**
 * Auth token required.
 * Each token lasts 1 day.
 * No more than 4 request can be made for a token per hour.
 */
let authToken: string | null = null
let token_expiry_timestamp: number | null = null

import { ethers } from 'ethers'
import { Request, Response } from 'express'
import { checkWalletOwnsPOAP } from '../../common/helpers/apis'
import { named } from '../lib/logger'

const secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3'
const ivBytes = new TextEncoder().encode('secret-words-xxx') // 16 bytes
const log = named('POAP-Handler')

async function getAesKey(): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(secretKey)
  return globalThis.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CTR' }, false, ['encrypt', 'decrypt'])
}

const encrypt = async (text: string): Promise<string> => {
  const key = await getAesKey()
  const data = new TextEncoder().encode(text)
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: 'AES-CTR', counter: ivBytes, length: 64 }, key, data)
  return Array.from(new Uint8Array(encrypted))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const decrypt = async (encryptedHex: string): Promise<string> => {
  const key = await getAesKey()
  const bytes = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  const decrypted = await globalThis.crypto.subtle.decrypt({ name: 'AES-CTR', counter: ivBytes, length: 64 }, key, bytes)
  return new TextDecoder().decode(decrypted)
}

//
// 1. Get list of QR Codes
// 2. Check status of QR code @ mint link index
// 3. Redeem first valid link. Return index.
// https://documentation.poap.tech/reference/postactionsclaim-qr
// https://documentation.poap.tech/reference/posteventqr-codes
// https://documentation.poap.tech/reference/getactionsclaim-qr
//
export async function redeemPoapForWallet(req: Request, res: Response) {
  const { event_id, code, wallet } = req.body

  if (!wallet || !ethers.isAddress(wallet)) {
    res.json({ success: false, error: 'Invalid user wallet, are you logged in?' })
    return
  }
  if (!code) {
    res.json({ success: false, error: 'Invalid Event Code' })
    return
  }
  if (typeof event_id != 'string') {
    res.json({ success: false, error: 'invalid event ID' })
    return
  }

  if (await checkWalletOwnsPOAP(event_id, wallet)) {
    res.json({ success: false, error: 'You already claimed that POAP' }) // or event is non-existent
    return
  }

  // code should already be encrypted
  const edit_code = await decrypt(code)

  // ensure it's valid
  await updateAuthToken()

  // retrieve the list
  const qrCodes = await getQrCodesForEvent(event_id, edit_code)
  if (!Array.isArray(qrCodes)) {
    res.json({ success: false, error: 'Could not fetch POAP.xyz' })
    return
  }
  const relevantQrCode = qrCodes.find((code) => {
    return !code.claimed
  })

  if (!relevantQrCode) {
    res.json({ success: false, error: 'All the tokens have been redeemed' })
    return
  }

  // get the secret key for a single poap
  // https://documentation.poap.tech/reference/getactionsclaim-qr
  const secret_url = `https://api.poap.tech/actions/claim-qr?qr_hash=${relevantQrCode.qr_hash}`
  let redeem_secret = null
  try {
    const p = await fetch(secret_url, { method: 'GET', headers: Object.assign({ Authorization: authToken }, headers) })
    const r = await p.json()
    if (r && r.secret) {
      redeem_secret = r.secret
    } else {
      res.json({ success: false, error: 'Could not fetch POAP.syz-1' })
      return
    }
  } catch (e) {
    log.error(e)
    res.json({ success: false, error: 'Could not fetch POAP.xyz-2' })
    return
  }

  // get the poap
  const url = `https://api.poap.tech/actions/claim-qr`
  const body = {
    address: wallet,
    qr_hash: relevantQrCode.qr_hash,
    secret: redeem_secret,
  }
  try {
    const p = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { ...headers, Authorization: authToken } as Record<string, any>, //  as Record<string, any>
    })
    const r = await p.json()
    if (r && r.claimed) {
      res.json({ success: true })
    } else {
      res.json({ success: false, error: 'Could not claim POAP.xyz' })
    }
  } catch (e) {
    log.error(e)
    res.json({ success: false, error: 'Could not fetch POAP.xyz-3' })
  }
}
/**
 * Encrypts the received code and sends it back to the caller
 * @returns
 */
export async function encryptPoapEditCode(req: Request, res: Response) {
  const { code } = req.body
  if (!code) {
    res.json({ success: false })
    return
  }

  res.json({ success: true, encrypted: await encrypt(code) })
}

/**
 * Retrieve list of QrCodes
 * @param event_id string
 * @param edit_code string
 * @returns list of something, I'm not sure what the result is, please fix.
 */
async function getQrCodesForEvent(event_id: string, edit_code: string) {
  const url = `https://api.poap.tech/event/${event_id}/qr-codes`
  const body = { secret_code: edit_code }
  try {
    const p = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { ...headers, Authorization: authToken } as Record<string, any>,
    })
    return (await p.json()) as { qr_hash: string; claimed: boolean }[]
  } catch (e) {
    log.error(e)
    return []
  }
}

/*
 * manually get authToken in dev and paste it in here.
 * Evertime the server restarts a new one is requested violating poap terms.
 * ! curl --location --request POST 'https://poapauth.auth0.com/oauth/token' --header 'Content-Type: application/json' --data '{ "audience": "cryptovoxels", "grant_type": "client_credentials", "client_id": "L0y10jmXBBKsCCsp5pvbtwFFDL8QtaXJ", "client_secret": "Z3bo5gsb0LQ0grmF48r58WbwUQ-Yw3rc3CaaozjNJl3Sc0bbVe0MtfVCmy4_tR1F" }'
 */
if (process.env.NODE_ENV != 'production') {
  authToken =
    'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik5qQTNOalpGUWpkRE9ESTNRa0V3UlVSRE9VVkVNRVUxT1VVd1JrSTNNRGs1TlRORVFqUTNSUSJ9.eyJpc3MiOiJodHRwczovL3BvYXBhdXRoLmF1dGgwLmNvbS8iLCJzdWIiOiJMMHkxMGptWEJCS3NDQ3NwNXB2YnR3RkZETDhRdGFYSkBjbGllbnRzIiwiYXVkIjoiY3J5cHRvdm94ZWxzIiwiaWF0IjoxNjUxNTIyOTA5LCJleHAiOjE2NTE2MDkzMDksImF6cCI6IkwweTEwam1YQkJLc0NDc3A1cHZidHdGRkRMOFF0YVhKIiwic2NvcGUiOiJtaW50IiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIiwicGVybWlzc2lvbnMiOlsibWludCJdfQ.14J6taKbqAzehKhyAxQdNQKEvh9m2ODs3uU2zGX0rtR7IAxg8hDPgxHBCKJh8rVgOp27r-nVHAyCrh3XbCGY4t5jc8sMiglyf9gAK4Rz5u8nXwtYl2LINhsML1yHWOVWtFFMHiKmWsTKLj_S_7fg_paYcw39ereDgrWIvSH4fsUJaen72Su0u97ZwUgtbyfFcFzn_znNo2TPy8DyWghhzBxzFdcPv_b0GqRIG77jodCJbLlow7HtKRBDjJYAaJ60sWtOK_WGEK04fw2A7vqWhBAt45EpUyM83rEt_iTpxfak6JzSdYI46kKXWJih7elqzMm_WGA0dmyI7cWC7BA_UQ'
  token_expiry_timestamp = Date.now() + 865000 // arbitrary
}
async function updateAuthToken() {
  if (
    authToken == null ||
    token_expiry_timestamp == null ||
    token_expiry_timestamp - Date.now() < 0 // as long as this is positive it means the token is still valid
  ) {
    const url = 'https://poapauth.auth0.com/oauth/token'
    const body = {
      audience: 'cryptovoxels',
      grant_type: 'client_credentials',
      client_id: 'L0y10jmXBBKsCCsp5pvbtwFFDL8QtaXJ',
      client_secret: POAP_SECRET_KEY,
    }
    try {
      const p = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers })
      const result = (await p.json()) as { access_token: string; scope: string; expires_in: number; token_type: string }
      authToken = `Bearer ${result.access_token}`
      token_expiry_timestamp = Date.now() + 86400000 // 1 day from now in milliseconds.
    } catch (e) {
      log.error(e)
    }
  }
}
