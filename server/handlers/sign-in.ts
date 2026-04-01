import { Signature, type SignatureLike, verifyMessage, hashMessage } from 'ethers'
import type { Request, Response } from 'express'
import { SignJWT } from 'jose'
import { ServerClient } from 'postmark'
import Avatar from '../avatar'
import { doesAvatarExist } from '../does-avatar-exist'
import { ensureAvatarExists } from '../ensure-avatar-exists'
import { isMod } from '../lib/helpers'
import { named } from '../lib/logger'
import { gnosisProxyContract, TokenAddress } from '../lib/utils'
import db from '../pg'

const log = named('sign_in')
const Base24 = require('base24')

const JWT_SECRET = process.env.JWT_SECRET || 'secret'
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET)

const MESSAGE = `# Terms of Service

I agree to the terms of service (and any future revisions) detailed at:

  https://www.voxels.com/terms

I agree to follow the code of conduct detailed at

  https://www.voxels.com/conduct

  `

type MessageSignature = `${typeof MESSAGE}Date: ${string}`

type Params = any

type SignInOptions = {
  rememberSignIn?: boolean
  providerName?: string
}

type MultiSigSignIn = {
  signature: 'multisig'
  options: SignInOptions & { chain?: number }
  wallet: TokenAddress
  message: MessageSignature
  email: string
  code: string
}

type PersonalSignIn = {
  wallet: string
  message: MessageSignature
  signature: SignatureLike
  options: SignInOptions
  email: string
  code: string
}

type SIM = PersonalSignIn | MultiSigSignIn

async function getEmailCode(email: string): Promise<{ code: string; expiry: string }> {
  // fixme - make dates stable in case people submit at midnight UTC
  const date = new Date().toISOString().split('T')[0]
  const salted = 'rainbox-ass-' + email.toString().replace(/^\s+/, '').replace(/\s+$/, '') + '-' + date.toString()
  const key = 'vitalik-is-my-homeboy'

  const cryptoKey = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signatureBuffer = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(salted))
  const buffer = new Uint8Array(signatureBuffer)
  const code = Base24.encode24(buffer).slice(0, 5)
  const expiry = new Date().toISOString().split('T')[0]

  return { code, expiry }
}

export async function EmailCode(req: Request<any, any>, res: Response) {
  if (!req.body.email) {
    res.json({ success: false, error: 'Email not present' })
    return
  }

  const email = req.body.email.toString().toLowerCase()
  const pattern = /^\S+@\S+\.\S+$/

  if (!email.match(pattern)) {
    res.json({ success: false, error: 'Invalid does not match our pattern' })
    return
  }

  const { code, expiry } = await getEmailCode(email)

  const html = `
    <p>Kia Ora!</p>

    <p>Your voxels login code is:</p>

    <h1 style="padding-left: 1rem">${code}</h1>

    <p>
      ❤️ Nga Mihi - voxels.com
    </p>

    <br />

    <hr />

    <p style="opacity: 0.5">
      ps: This code is valid on ${expiry}. If you are not trying to log into voxels.com with this email, please ignore this message.
    </p>
  `

  const text = `Kia Ora!

Your voxels login code is: ${code}

<3 Nga Mihi - voxels.com

----
ps: This code is valid on ${expiry}. If you are not trying to log into voxels.com with this email, please ignore this message.
`

  const serverToken = 'ab3cbb8b-4211-457c-bd25-e477ca337e27'

  const client = new ServerClient(serverToken)

  client.sendEmail({
    From: 'Voxels Team<team@voxels.com>',
    To: email,
    Subject: `Login code ${code}`,
    TextBody: text,
    HtmlBody: html,
  })

  // fs.writeFileSync('/Users/ben/Desktop/email.eml', message)
  // exec('open /Users/ben/Desktop/email.eml')

  res.json({ success: true })
}

export async function SignIn(req: Request<any, Params>, res: Response) {
  const params = req.body as Partial<SIM>

  if (params.email && params.code) {
    const { code } = params
    let { email } = params
    email = email.toLowerCase()

    const expected = await getEmailCode(email)

    if (code != expected.code) {
      console.log(`Expected ${expected.code}, got ${code} for email ${email} with expiry ${expected.expiry}`)
      res.json({ success: false, error: `Invalid code ${expected.code} for email ${email} with expiry ${expected.expiry}` })

      return
    }

    // Successful authentication

    const r = await db.query('embedded/get-user-uuid', 'select get_or_create_user_uuid($1) as uuid', [email])
    const wallet = r && r.rows[0] && r.rows[0].uuid

    console.log(`non wallet is ${wallet}`)

    const { token, name, isNewUser } = await getUserInfo(res, wallet, {})
    res.json({ success: true, token, name, isNewUser })
    return
  }

  if (!params.message || !params.signature || !params.wallet) {
    res.json({ success: false })
    return
  }

  // The signature (message) is composed of the message + Date:[date].
  // Therefore we split the message in 2 components: Message component and Date component
  const msgComponents = params.message.split('Date: ')
  // Add seconds back into the date
  // probably unecessary
  const dateSigned = Date.parse(msgComponents[1])

  // Verify the signature message  (component 1 of the signature)
  if (msgComponents[0] !== MESSAGE) {
    log.debug('Bad message signature')
    res.json({ success: false, message: 'bad message' })
    return
  }
  // Check date of signature (+24hr within -24hr) (component 2 of the signature)
  if (dateSigned < Date.now() - 86400 * 1000 && dateSigned > Date.now() + 86400 * 1000) {
    log.debug('Bad date signature')

    res.json({ success: false, message: 'bad date' })
    return
  }

  // when personal sign
  if (params.signature !== 'multisig') {
    await personalSignIn(res, params.wallet, params.message, params.signature, params.options || {})
  } else {
    // when multi sig
    const multi = params as MultiSigSignIn // :( typescript needs a little help here
    await multiSigSignIn(res, multi.wallet, multi.message, multi.options)
  }
}

async function personalSignIn(res: Response, wallet: string, message: MessageSignature, signature: SignatureLike, options: SignInOptions) {
  let sig: Signature | null = null

  let x: string | null = null
  try {
    sig = Signature.from(signature as any)
  } catch {
    log.debug('signature is invalid')
    res.json({ success: false, message: 'bad signature' })
    return
  }

  try {
    x = verifyMessage(message, sig as any)
  } catch (e) {
    log.debug("signature and message don't match")
    res.json({ success: false })
    return
  }

  if (!x || x.toLowerCase() !== wallet.toLowerCase()) {
    log.debug("Wallets don't match!")
    res.json({ success: false })
    return
  }
  const { token, name, isNewUser } = await getUserInfo(res, wallet, options)

  res.json({ success: true, token, name, isNewUser })
}

async function multiSigSignIn(res: Response, wallet: TokenAddress, message: MessageSignature, options?: SignInOptions & { chain?: number }): Promise<void> {
  const wsSafeProxyContract = await gnosisProxyContract(wallet, options?.chain)
  if (!wsSafeProxyContract) {
    res.json({ success: false })
    return
  }
  const msgHash = hashMessage(message)
  const getMessageHash = await wsSafeProxyContract.getMessageHash(msgHash)

  const waitForSignedEvent = new Promise<boolean>((myResolve, myReject) => {
    const onMultiSigSigned = () => {
      myResolve(true)
    }
    setTimeout(
      () => {
        wsSafeProxyContract.removeListener(wsSafeProxyContract.filters.SignMsg(getMessageHash), onMultiSigSigned)
        myReject(false)
      },
      5 * 60 * 60 * 1000,
    )
    // login() only after the _signMessage() txn is mined and SignMsg(msgHash) event emitted
    wsSafeProxyContract.once(wsSafeProxyContract.filters.SignMsg(getMessageHash), onMultiSigSigned)
  })
  waitForSignedEvent
    .then(async (value) => {
      if (value) {
        const { token, name, isNewUser } = await getUserInfo(res, wallet, options || {})
        res.json({ success: true, token, name, isNewUser })
      }
    })
    .catch((err) => {
      log.error('failed getting user info', err)
      res.json({ success: false })
    })
}

async function getUserInfo(res: Response, wallet: string, options: SignInOptions): Promise<{ token: string; name: string; isNewUser: boolean }> {
  if (!wallet) {
    throw new Error('Invalid wallet')
  }
  const maxAgeMs = 61 * 24 * 60 * 60 * 1000 // ~2 months
  const expiresAtMs = Date.now() + maxAgeMs

  const payload = { wallet, moderator: isMod({ user: { wallet } }) }
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAtMs / 1000))
    .sign(JWT_SECRET_KEY)
  res.cookie('jwt', token, { ...(!!options.rememberSignIn && { maxAge: maxAgeMs }) })

  const avatarExists = await doesAvatarExist(wallet)

  // make sure we have the avatar in the DB or else new users won't get multiplayer permissions
  await ensureAvatarExists(wallet)

  let name = null
  if (avatarExists) {
    try {
      const r = await db.query('embedded/get-avatar-name', 'select name from avatars where lower(owner)=lower($1)', [wallet])
      name = r && r.rows[0] && r.rows[0].name
    } catch (e: any) {
      log.error(`sign-in.ts: ${e.toString()}`)
      name = null
    }
  } else {
    // avatar doesn't exist, it's a new user, maybe that user has an ENS name
    name = await Avatar.setENSNameIfAny(wallet)
  }
  return { token, name, isNewUser: !avatarExists }
}
