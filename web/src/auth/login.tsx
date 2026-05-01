import { useState } from 'preact/hooks'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { isMobile } from '../../../common/helpers/detector'
import { hasMetamask } from '../auth/login-helper'
import { login } from '../auth/state-login'
import { app } from '../state'

const fetchParams = {
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
} as const

async function postJSON(url: string, body: unknown) {
  const f = await fetch(url, { ...fetchParams, method: 'POST', body: JSON.stringify(body), credentials: 'include' })
  let data: any
  try {
    data = await f.json()
  } catch {
    throw new Error('Bad response from server')
  }
  if (!f.ok) {
    const msg = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : `Request failed (${f.status})`
    throw new Error(msg)
  }
  return data
}

enum Status {
  Initial,
  Sending,
  Sent,
  Submitting,
}

export const SignIn = () => {
  const [status, setStatus] = useState(Status.Initial)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [passkeyUsername, setPasskeyUsername] = useState('')
  const [passkeyError, setPasskeyError] = useState('')
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyPhase, setPasskeyPhase] = useState<null | 'login' | 'register'>(null)

  const finishPasskeySession = (r: { success: boolean; token?: string; name?: string | null; isNewUser?: boolean; error?: string }) => {
    if (!r.success) {
      setPasskeyError(r.error || 'Something went wrong')
      return
    }
    if (!r.token) {
      setPasskeyError('No session token from server')
      return
    }
    login.onToken(r.token, r.name ?? null, !!r.isNewUser)
    if (!app.signedIn) {
      setPasskeyError('Could not start your session. Try again or use email or wallet.')
    }
  }

  const onPasskeyRegister = async () => {
    if (!passkeyUsername.trim() || passkeyBusy) return
    setPasskeyBusy(true)
    setPasskeyPhase('register')
    setPasskeyError('')
    try {
      const opts = await postJSON('/api/passkey/register/options', { username: passkeyUsername })
      if (!opts.success) {
        setPasskeyError(opts.error || 'Failed')
        return
      }
      const attResp = await startRegistration({ optionsJSON: opts.options })
      const r = await postJSON('/api/passkey/register/verify', { username: passkeyUsername, attResp })
      finishPasskeySession(r)
    } catch (e: any) {
      setPasskeyError(e?.message || 'Cancelled')
    } finally {
      setPasskeyBusy(false)
      setPasskeyPhase(null)
    }
  }

  const onPasskeyLogin = async () => {
    if (!passkeyUsername.trim() || passkeyBusy) return
    setPasskeyBusy(true)
    setPasskeyPhase('login')
    setPasskeyError('')
    try {
      const opts = await postJSON('/api/passkey/login/options', { username: passkeyUsername })
      if (!opts.success) {
        setPasskeyError(opts.error || 'Failed')
        return
      }
      const authResp = await startAuthentication({ optionsJSON: opts.options })
      const r = await postJSON('/api/passkey/login/verify', { username: passkeyUsername, authResp })
      finishPasskeySession(r)
    } catch (e: any) {
      setPasskeyError(e?.message || 'Cancelled')
    } finally {
      setPasskeyBusy(false)
      setPasskeyPhase(null)
    }
  }

  const pattern = '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$'

  const onClick = (e: Event) => {
    const canInstallMetamask = !isMobile() && !hasMetamask()
    if (canInstallMetamask) {
      window.open('https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn', '_blank', 'noopener')
    } else {
      login.signin()
    }
  }

  const onSubmit = async (e: Event) => {
    e.preventDefault()

    if (status == Status.Sending) {
      return
    } else if (status == Status.Initial) {
      setStatus(Status.Sending)

      const body = JSON.stringify({ email })
      const f = await fetch('/api/signin/code', { ...fetchParams, method: 'POST', body })
      const j = await f.json()

      if (j.success) {
        setStatus(Status.Sent)
      } else {
        setStatus(Status.Initial)

        alert(j.message)
      }
    } else if (status == Status.Sent) {
      setStatus(Status.Submitting)

      login.emailSignin(email, code)
    }
  }

  const onReset = (e: Event) => {
    setStatus(Status.Initial)
    e.preventDefault()
  }

  return (
    <section class="login">
      <div class="login-form">
        <div class="login-block">
          <h1>Wallet</h1>
          <button type="button" onClick={onClick}>
            <img src={'/images/metamask.png'} width={30} height={30} title={'Metamask'} alt="" />
            &nbsp;Metamask
          </button>
        </div>

        <hr class="login-form-divider" />

        <div class="login-block">
          <h1>Email code</h1>
          <form onSubmit={onSubmit}>
            {(status == Status.Initial || status == Status.Sending) && (
              <>
                <p class="login-hint">Email sign-in works for browsing, but you will not be able to buy parcels or receive on-chain payouts.</p>
                <fieldset>
                  <label>
                    Email
                    <input onInput={(e) => setEmail(e.currentTarget.value)} type="email" autocomplete="email" name="email" autocapitalize="none" required pattern={pattern} />
                  </label>
                </fieldset>
                {status == Status.Sending ? <button disabled>Submitting...</button> : <button>Continue</button>}
              </>
            )}

            {(status == Status.Sent || status == Status.Submitting) && (
              <fieldset>
                <label>
                  Code
                  <input maxLength={6} autofocus onInput={(e: any) => setCode(e.target.value)} type="text" />
                </label>
                <p class="login-actions">
                  {status == Status.Submitting ? <button disabled>Submitting...</button> : <button>Sign in</button>}
                  <span class="login-or-cancel">
                    or{' '}
                    <a href="" role="button" onClick={onReset}>
                      cancel
                    </a>
                  </span>
                </p>
              </fieldset>
            )}
          </form>
        </div>

        <hr class="login-form-divider" />

        <div class="login-block">
          <h1>Passkey</h1>
          <fieldset>
            <label>
              Username
              <input value={passkeyUsername} onInput={(e: any) => setPasskeyUsername(e.target.value)} type="text" autocomplete="username" autocapitalize="none" placeholder="Your username" />
            </label>
          </fieldset>
          {passkeyError ? <p class="login-error">{passkeyError}</p> : null}
          {passkeyBusy ? (
            <button type="button" class="login-passkey-wait" disabled>
              {passkeyPhase === 'register' ? 'Creating account...' : 'Signing in...'}
            </button>
          ) : (
            <div class="login-passkey-actions">
              <button type="button" onClick={onPasskeyLogin} disabled={!passkeyUsername.trim()}>
                Sign in
              </button>
              <button type="button" onClick={onPasskeyRegister} disabled={!passkeyUsername.trim()}>
                Create account
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
