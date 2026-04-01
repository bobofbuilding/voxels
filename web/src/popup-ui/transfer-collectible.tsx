import { render } from 'preact'
import Panel from '../components/panel'
import { NFTTransferState, TransferCollectibleHelper } from '../helpers/transfer-collectible'
import WearableHelper from '../helpers/collectible'
import { isAddress } from 'ethers'
import { Spinner } from '../spinner'
import { TextField } from '../components/fields/text-field'
import { NumberField } from '../components/fields/number-fields'
import { TargetedEvent, unmountComponentAtNode } from 'preact/compat'
import { Form } from '../components/fields/form'
import { Submit } from '../components/fields/submit'
import { getTransactionLink } from '../helpers/transaction-helpers'
import { useEffect, useState } from 'preact/hooks'

export const TransactionLink = (props: { transactionLink: string }) => {
  const transactionLink = props.transactionLink
  return (
    <div>
      {props.transactionLink && (
        <a href={transactionLink} target="_blank">
          See the transaction in a new tab
        </a>
      )}
    </div>
  )
}

export interface Props {
  collectible: WearableHelper
  wallet?: string
  onClose?: () => void
}

export function TransferCollectibleWindow(props: Props) {
  const [balance, setBalance] = useState<number | undefined>(undefined)
  const [quantity, setQuantity] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [transferTo, setTransferTo] = useState<string>('')
  const [transferState, setTransferState] = useState<NFTTransferState | null>(null)

  const transactionHelper = new TransferCollectibleHelper()
  const disabled = balance === 0 || transferState !== null
  const submitDisabled = disabled || !isAddress(transferTo) || quantity < 1 || quantity > (balance ?? 0)

  useEffect(() => {
    if (!props.collectible.collection_address) throw new Error('no collection address')
    transactionHelper
      .getBalance(props.collectible, false)
      .then((balance) => {
        setBalance(Number(balance))
        setTransferState(null)
        setQuantity(1)
      })
      .catch((err) => setError(err.message || 'unknown error'))
  }, [props.collectible.collection_address])

  useEffect(() => {
    if (transferState?.state === 'transferred') setTransferTo('')
  }, [transferState])

  useEffect(() => {
    if (error) console.error(error)
  }, [error])

  const transfer = async () => {
    setError(null)
    setTransferState(null)
    const transfer = transactionHelper.startTransfer(props.collectible, transferTo, quantity)
    try {
      for await (const i of transfer) {
        setTransferState(i)
      }
    } catch (e: any) {
      setTransferState(null)
      setError(e.message)
    }
  }

  return (
    <div>
      <header>
        <h3>Transfer collectable</h3>
        <button onClick={props.onClose}>&times;</button>
        <div>Use this form to transfer "{props.collectible.name}" to someone</div>
      </header>
      <section>
        <Form onSubmit={transfer}>
          <TextField
            name="Transfer to"
            value={transferTo}
            onChange={(ev: TargetedEvent<HTMLInputElement>) => {
              setTransferTo(ev.currentTarget['value'])
              setTransferState(null)
            }}
            placeholder="0x123456789..."
            size={42}
            maxLength={45}
            disabled={disabled}
          ></TextField>
          <NumberField name="Quantity" value={quantity} onChange={(ev: TargetedEvent<HTMLInputElement>) => setQuantity(parseInt(ev.currentTarget['value'], 10))} size={6} maxLength={5} min={1} max={balance} disabled={disabled}>
            You currently own {balance ?? <Spinner size={12} bg="light" />}
          </NumberField>
          <Submit label="Transfer" disabled={submitDisabled} />
          {!error && <TransactionStatus state={transferState} />}
          {error && <Panel type="danger">{error}</Panel>}
          <div>{transferState?.hash && <TransactionLink transactionLink={getTransactionLink(props.collectible.chain_id, transferState?.hash)} />}</div>
        </Form>
      </section>
    </div>
  )
}

export function TransactionStatus({ state }: { state: NFTTransferState | null }) {
  if (!state?.state) return null
  const getMessage = (s: NFTTransferState): string => {
    switch (s.state) {
      case 'network-switching':
        return 'Trying to switch network'
      case 'approving-contract':
        return 'Awaiting the approval of the transfer contract'
      case 'confirming':
        return 'Awaiting your confirmation of the transaction'
      case 'transferring':
        return 'Waiting for transaction to complete'
      case 'transferred':
        return 'Wearable was transferred, you can safely close this dialogue.'
      default:
        const _never: never = s.state
        return ''
    }
  }
  const showSpinner = !['idle', 'transferred'].includes(state.state)
  return (
    <div>
      {showSpinner && <Spinner size={16} bg="light" />}
      <span>
        {state.step}/{state.totalSteps} {getMessage(state)}
      </span>
    </div>
  )
}

export function toggleCollectibleTransfer(collectible: WearableHelper, wallet?: string, onClose?: () => void): Promise<void> {
  const d = document.querySelector('div.TransferCollectibleWindow')
  if (d) {
    unmountComponentAtNode(d)
    d.remove()
  }
  const div = document.createElement('div')
  div.className = 'TransferCollectibleWindow'

  return new Promise(function (resolve) {
    const close = () => {
      unmountComponentAtNode(div)
      div?.remove()
      onClose?.()
      resolve()
    }
    document.body.appendChild(div)
    render(<TransferCollectibleWindow collectible={collectible} wallet={wallet} onClose={close} />, div)
  })
}
