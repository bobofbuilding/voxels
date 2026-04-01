import { useState } from 'preact/hooks'
import { isMobile } from '../../../common/helpers/detector'
import { hasMetamask } from '../auth/login-helper'
import { login } from '../auth/state-login'
import { Separator } from '../components/separator/separator'

const fetchParams = {
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
} as const
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
      <br />
      {/* <hgroup>
        <h1>Log in</h1>
        <p>Sign in with Metamask or a one-time password sent to your email.</p>
      </hgroup> */}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <h4>Sign in with a Web3 wallet</h4>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={onClick}>
            <img src={'/images/metamask.png'} width={30} height={30} title={'Metamask'} />
            &nbsp;
            {'Metamask'}
          </button>
        </div>
        <Separator text="or" type="horizontal" />
        <form onSubmit={onSubmit}>
          <h4>Sign in with One Time Password</h4>
          {(status == Status.Initial || status == Status.Sending) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <small style={{ maxWidth: '300px', fontSize: '0.7rem' }}>Email sign-in lets you join the party. However, you won't be able to buy parcels or receive crypto assets</small>
              <fieldset>
                <label>
                  Email
                  <input onInput={(e) => setEmail(e.currentTarget.value)} type="email" autocomplete="email" name="email" autocapitalize="none" required pattern={pattern} />
                </label>
              </fieldset>
              {status == Status.Sending ? <button disabled>Submitting...</button> : <button>Continue</button>}
            </div>
          )}

          {(status == Status.Sent || status == Status.Submitting) && (
            <fieldset>
              <label>
                Code
                <input maxLength={6} autofocus onInput={(e: any) => setCode(e.target.value)} type="text" />
              </label>
              {status == Status.Submitting ? <button disabled>Submitting...</button> : <button>Sign in</button>} or{' '}
              <a href="" role="button" onClick={onReset}>
                cancel
              </a>
            </fieldset>
          )}
        </form>
      </div>
    </section>
  )
}
