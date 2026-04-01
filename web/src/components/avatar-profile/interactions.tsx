import { Fragment } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { format } from 'timeago.js'
import { app } from '../../state'
import { fetchAPI, fetchOptions } from '../../utils'
import { PanelType } from '../panel'
// import AvatarCanvas from '../../../../src/ui/costumers/avatar-canvas'
import { openMailboxUI } from '../mailbox/mailbox-ui'

type InteractionsProps = {
  wallet?: string
}

type Suspension = {
  can_build: boolean
  can_chat: boolean
  created_at: string
  expires_at: string
  id: number
  reason: string
  wallet: string
}

export default function Interactions(props: InteractionsProps) {
  const [isMod, setIsMod] = useState<boolean>(false)
  const [suspension, setSupension] = useState<Partial<Suspension>>({})

  useEffect(() => {
    app.getState().then((appState) => setIsMod(!!appState.moderator))
  }, [app.signedIn])

  const fetchSuspension = () => {
    fetch(`${process.env.API}/avatar/${props.wallet}/suspended?nonce=${Math.random()}`, fetchOptions())
      .then((r) => r.json())
      .then((r: { suspended: Suspension }) => {
        setSupension(r.suspended)
      })
  }

  useEffect(() => {
    if (!isMod) return
    fetchSuspension()
  }, [isMod])

  const suspend = (days: number) => {
    const reason = prompt('Enter reason for suspension (will be sent to user)')
    if (!reason) {
      app.showSnackbar("Can't suspend user without a reason", PanelType.Danger)
      return
    }
    const body = { reason, days } /*add can_chat:true or can_build:true to allow those. */
    fetchAPI(`/api/avatar/${props.wallet}/suspend`, fetchOptions(undefined, JSON.stringify(body))).then(fetchSuspension)
  }

  const unsuspend = () => {
    if (!confirm('Are you sure you want to unsuspend this user before the current expiry?')) return
    return fetchAPI(`/api/avatar/${props.wallet}/unsuspend`, fetchOptions(undefined, JSON.stringify({}))).then(fetchSuspension)
  }

  const suspendButton = (days: number) => (suspension.wallet ? <a onClick={() => unsuspend()}>Unsuspend</a> : <a onClick={() => suspend(days)}>Suspend user for {days} days</a>)

  return (
    <div>
      <a onClick={() => props.wallet && openMailboxUI(props.wallet)}>Message</a>
      {app.state.moderator &&
        (suspension?.expires_at ? (
          <span>
            Wallet is suspended for {format(suspension?.expires_at)}, <i>{suspension?.reason}</i> <a onClick={() => unsuspend()}>Unsuspend</a>
          </span>
        ) : (
          <Fragment>
            {suspendButton(7)}
            {suspendButton(30)}
          </Fragment>
        ))}
    </div>
  )
}
