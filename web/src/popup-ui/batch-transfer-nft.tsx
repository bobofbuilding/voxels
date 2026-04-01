import { createRef, render } from 'preact'
import { app } from '../state'
import Panel, { PanelType } from '../components/panel'
import { useEffect, useState } from 'preact/hooks'
import { resolveName } from '../auth/login-helper'
import { isAddress } from 'ethers'
import { getTransactionLink } from '../helpers/transaction-helpers'
import { BATCH_TRANSFER_ETH, BATCH_TRANSFER_MATIC, BatchTransferWrapper, NFTTransferState, TransferableNFT } from '../helpers/transfer-collectible'
import WearableHelper from '../helpers/collectible'
import { TargetedEvent, unmountComponentAtNode } from 'preact/compat'
import { Ethereum, Polygon } from '../../../common/helpers/chain-helpers'
import { Form } from '../components/fields/form'
import { TextField } from '../components/fields/text-field'
import { SelectField } from '../components/fields/select-field'
import { TransactionLink, TransactionStatus } from './transfer-collectible'
import { Submit } from '../components/fields/submit'
import { Spinner } from '../spinner'
import { JSXInternal } from 'preact/src/jsx'
import TargetedKeyboardEvent = JSXInternal.TargetedKeyboardEvent

export interface Props {
  nft?: TransferableNFT
  wallets?: string[]
  onClose?: () => void
}

export interface State {
  nft: TransferableNFT
  transferring: boolean
  approving: boolean
  approved: boolean
  success: boolean
  error: string | null
  hash: string | null
  transferTo: string[]
}

export default function BatchTransferNFTWindow(props: Props) {
  const transactionHelper = new BatchTransferWrapper()

  const [nft, setNFT] = useState<TransferableNFT>(props.nft ?? { chain_id: Polygon })
  const [error, setError] = useState<string>('')
  const [transferTo, setTransferTo] = useState<string[]>([])
  const [disabled, setDisabled] = useState<boolean>(false)
  const [transferState, setTransferState] = useState<NFTTransferState | null>(null)
  const [approved, setApproved] = useState<boolean>(false)
  const [revoking, setRevoking] = useState<boolean>(false)

  useEffect(() => {
    transactionHelper.isApproved(nft).then(setApproved)
    setTransferTo(props.wallets?.map((w) => w.toLowerCase()) ?? [])
  }, [])

  useEffect(() => {
    setTransferTo(props.wallets?.map((w) => w.toLowerCase()) ?? [])
  }, [props.wallets])

  useEffect(() => {
    if (transferState?.state === 'transferring') setApproved(true)
  }, [transferState])

  const transfer = async () => {
    setDisabled(true)
    setError('')
    setTransferState(null)
    const transfer = transactionHelper.transfer(nft, transferTo)
    try {
      for await (const i of transfer) {
        setTransferState(i)
      }
    } catch (e: any) {
      setError(e.toString())
      setTransferState(null)
    }
  }

  const revoke = async () => {
    setRevoking(true)
    await transactionHelper
      .revokeApproval(nft)
      .then(() => setApproved(false))
      .catch((e) => setError(e.toString()))
      .finally(() => setRevoking(false))
  }

  const submitDisabled = disabled || !transferTo.length || !nft.collection_address || !nft.chain_id || !nft.token_id

  return (
    <Form onSubmit={transfer}>
      <h3>Batch Transfer</h3>

      <TextField
        name="ContractAddress"
        label={'Contract address'}
        value={nft.collection_address?.toString() ?? ''}
        onChange={(ev: TargetedEvent<HTMLInputElement>) => setNFT({ ...nft, collection_address: ev.currentTarget['value'] })}
        placeholder="0x123456789..."
        size={42}
        maxLength={45}
        disabled={disabled}
      />
      <TextField
        name="TokenID"
        label={'Token id'}
        value={nft.token_id?.toString() ?? ''}
        onChange={(ev: TargetedEvent<HTMLInputElement>) => setNFT({ ...nft, token_id: parseInt(ev.currentTarget['value'], 10) })}
        size={5}
        maxLength={5}
        disabled={disabled}
      />
      <SelectField
        name={'chainID'}
        label={'Chain'}
        options={{ '1': 'Ethereum', '137': 'Polygon' }}
        value={nft.chain_id?.toString() || Polygon.toString()}
        onChange={(e) => {
          const chain_id = parseInt(e.currentTarget.value)
          if (chain_id !== Polygon && chain_id !== Ethereum) {
            setError(`Invalid chain id ${chain_id}`)
            return
          }
          setNFT({ ...nft, chain_id: chain_id })
        }}
      />

      <div class="f">
        <label>Recipients</label>
        <WalletManager propsWallets={transferTo} onChange={(wallets: string[]) => setTransferTo(wallets)} />
      </div>

      <Submit label={'Transfer'} disabled={submitDisabled} />

      <div>
        {!error && <TransactionStatus state={transferState} />}
        {error && <Panel type="danger">{error}</Panel>}
        <div>{transferState?.hash && <TransactionLink transactionLink={getTransactionLink(nft.chain_id, transferState?.hash)} />}</div>

        {approved && !revoking && (!transferState?.state || transferState?.state === 'transferred') && (
          <div>
            You can <a onClick={revoke}>revoke approval</a> of our multi transfer contract
          </div>
        )}
        {approved && revoking && (
          <div>
            <Spinner size={16} bg="light" /> Revoking contract approval
          </div>
        )}
      </div>

      <div>
        <b>This tool lets you transfer NFTs to multiple wallets in five steps:</b>
        <ol>
          <li>Switch wallet to correct network</li>
          <li>
            Approve our smart contract to transfer your NFTs to multiple wallets at the same time (contract code at{' '}
            <a href={`https://etherscan.io/address/${BATCH_TRANSFER_ETH}#code`} target="_blank">
              Etherscan
            </a>{' '}
            or{' '}
            <a href={`https://polygonscan.com/address/${BATCH_TRANSFER_MATIC}#code`} target="_blank">
              polygonscan
            </a>
            )
          </li>
          <li>Confirm the transaction and gas</li>
          <li>Wait for transaction to complete</li>
          <li>(optional) Revoke contract approval</li>
        </ol>
      </div>
    </Form>
  )
}

export function WalletManager({ propsWallets, onChange }: { propsWallets?: string[]; onChange: (wallets: string[]) => void }) {
  const [wallets, setWallets] = useState<string[]>(propsWallets ?? [])
  useEffect(() => onChange(wallets), [wallets])
  useEffect(() => setWallets(propsWallets ?? []), [propsWallets])

  const addWallets = (list: string[]) => {
    setWallets((wallets) => [...wallets, ...list])
  }

  const removeWallet = (value: string) => {
    setWallets((wallets) => wallets.filter((w) => w.toLowerCase() !== value.toLowerCase()))
  }

  return (
    <div>
      {wallets.map((wallet) => (
        <Wallet key={wallet} wallet={wallet} onRemove={removeWallet} />
      ))}
      {wallets.length > 0 && <br />}
      <AddWallet addWallets={addWallets} wallets={wallets} />
    </div>
  )
}

function Wallet({ wallet, onRemove }: { wallet: string; onRemove: (wallet: string) => void }) {
  const remove = (e: TargetedEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onRemove(wallet)
  }
  return (
    <div key={wallet}>
      <div>
        <div>{wallet}</div>
        <button onClick={remove}>Remove</button>
      </div>
    </div>
  )
}

function AddWallet(props: { addWallets: (v: string[]) => void; wallets: string[] }) {
  const [wallet, setWallet] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [disabled, setDisabled] = useState<boolean>(false)

  const inputEl = createRef<HTMLInputElement>()

  useEffect(() => setError(''), [wallet])

  const validateAddresses = (newWallets: string) => {
    setDisabled(true)
    const wallets = newWallets.split(',')
    const promises = wallets.filter((addr) => app.state?.wallet?.toLowerCase() !== addr.toLowerCase()).map((addr) => getAddress(addr))

    return Promise.all(promises)
      .then((addresses) => {
        props.addWallets(addresses)
        setWallet('')
        inputEl.current?.focus()
      })
      .catch((e) => setError(e.message))
      .finally(() => setDisabled(false))
  }

  const getAddress = async (candidate: string): Promise<string> => {
    let address: string = candidate.trim().toLowerCase()
    if (address.endsWith('.eth')) {
      const reverseLookup = (await resolveName(candidate)) ?? ''
      if (!reverseLookup) {
        throw new Error(`'${address}' doesn't resolve to an wallet address`)
      }
      address = reverseLookup?.toLowerCase()
    }
    if (!isAddress(address)) {
      throw new Error(`Address '${address}' is not valid`)
    }
    // Check we haven't already recorded that address.
    if (props.wallets.find((w) => w.toLowerCase() == address?.toLowerCase())) {
      throw new Error('Address already listed')
    }
    return address
  }

  const handleEnter = async (e: TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    await validateAddresses(e.currentTarget.value)
  }

  const handleAdd = async (e: TargetedEvent<HTMLButtonElement>) => {
    e.preventDefault()
    await validateAddresses(wallet)
  }

  const handleOnChange = (e: TargetedEvent<HTMLInputElement>) => setWallet(e.currentTarget.value)

  return (
    <div>
      <input ref={inputEl} type="text" disabled={disabled} placeholder="Address or ENS" value={wallet} onChange={handleOnChange} onKeyPress={handleEnter} />
      &nbsp;
      <button disabled={disabled} onClick={handleAdd}>
        Add
      </button>
    </div>
  )
}
