import { Component } from 'preact'
import { Contract, isAddress } from 'ethers'
import { SUPPORTED_CHAINS_BY_ID } from '../../common/helpers/chain-helpers'
import { web3ExtractErrorMessage } from '../../common/helpers/utils'
import { handleTransaction } from './helpers/transfer-collectible'
import { provider } from './auth/state-login'
import { app } from './state'
import { fetchOptions } from './utils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const factoryAbi = require('../../common/contracts/collections-factory.json')

const CHAINS = [{ id: '1', name: 'Ethereum' }, { id: '137', name: 'Polygon' }, ...(process.env.NODE_ENV === 'development' ? [{ id: '80001', name: 'Mumbai' }] : [])]

interface State {
  chainId: number | null
  contractName: string
  accepted: boolean
  deploying: boolean
  error: string | null
  done: boolean
  address: string | null
  collectionId: number
  collectionName: string
}

export default class PublishCollection extends Component<{ mint?: string }, State> {
  state: State = {
    chainId: null,
    contractName: '',
    accepted: false,
    deploying: false,
    error: null,
    done: false,
    address: null,
    collectionId: 0,
    collectionName: '',
  }

  componentDidMount() {
    const id = parseInt(this.props.mint || '', 10)
    if (!id) return
    fetch(`/api/collections/${id}`, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        if (r.collection) {
          this.setState({ collectionId: r.collection.id, contractName: r.collection.name, collectionName: r.collection.name })
        }
      })
  }

  async deploy() {
    this.setState({ error: null })
    const { chainId, contractName, accepted, collectionId } = this.state

    if (!accepted) {
      this.setState({ error: 'Accept the terms first.' })
      return
    }
    if (!chainId) {
      this.setState({ error: 'Select a chain.' })
      return
    }
    if (!contractName.trim()) {
      this.setState({ error: 'Contract name required.' })
      return
    }
    if (!provider.signer) {
      this.setState({ error: 'Not signed in.' })
      return
    }

    const signerChain = await (provider.signer as any).getChainId()
    if (signerChain != chainId) {
      provider.switchNetwork(chainId)
      this.setState({ error: 'Switch to the correct chain in your wallet, then try again.' })
      return
    }

    const w3 = provider.ethersWeb3Provider()
    const bal = w3 && app.state.wallet ? Number(await w3.getBalance(app.state.wallet)) / 1e18 : 0
    if (bal <= 0.0001) {
      this.setState({ error: `Insufficient ${chainId === 1 ? 'ETH' : 'MATIC'} balance.` })
      return
    }

    this.setState({ deploying: true })
    const addr = chainId === 137 ? process.env.COLLECTION_FACTORY_CONTRACT_MATIC : process.env.COLLECTION_FACTORY_CONTRACT_ETH
    const contract = new Contract(addr!, factoryAbi.abi, provider.getSigner())

    let tx
    try {
      tx = await contract.launchCollection(collectionId, contractName, {})
    } catch (e: any) {
      this.setState({ deploying: false, error: e.code === 4001 ? 'Transaction rejected.' : web3ExtractErrorMessage(e) || 'Deploy failed.' })
      return
    }

    let receipt: any
    try {
      receipt = await handleTransaction(tx)
    } catch {
      this.setState({ deploying: false, error: 'Transaction error.' })
      return
    }

    let contractAddr: string | null = null
    if (receipt?.events) {
      const ev = receipt.events.find((e: any) => e.event === 'NewCollectionCreated')
      if (ev && isAddress(ev.args[0])) contractAddr = ev.args[0]
    }
    if (!contractAddr && receipt?.logs?.[0]) contractAddr = receipt.logs[0].address
    if (!contractAddr || !isAddress(contractAddr)) {
      this.setState({ deploying: false, error: 'Could not get contract address.' })
      return
    }

    const save = await fetch(`/api/collections/${collectionId}/address`, {
      ...fetchOptions(),
      method: 'put',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: contractAddr }),
    }).then((r) => r.json())

    if (!save.success) {
      this.setState({ deploying: false, error: save.message || 'Deployed but failed to save address.' })
      return
    }

    this.setState({ deploying: false, done: true, address: contractAddr })
  }

  render() {
    const { done, address, chainId, deploying, error, accepted, contractName, collectionName, collectionId } = this.state

    if (done) {
      const explorer = chainId !== 1 ? `https://polygonscan.com/address/${address}` : `https://etherscan.io/address/${address}`
      return (
        <section class="columns">
          <hgroup>
            <h1>Published!</h1>
            <p>Contract deployed for {collectionName}.</p>
          </hgroup>
          <article>
            <p>
              Address: <code>{address}</code>
            </p>
            <a href={explorer} target="_blank">
              View on {chainId !== 1 ? 'Polygonscan' : 'Etherscan'}
            </a>
            <br />
            <br />
            <a href={`/collections/${collectionId}`}>Back to collection</a>
          </article>
        </section>
      )
    }

    return (
      <section class="columns">
        <hgroup>
          <h1>Publish: {collectionName}</h1>
          <p>Deploy a smart contract for this collection on-chain.</p>
        </hgroup>
        <article>
          <label>Chain</label>
          <select
            value={chainId ?? ''}
            onChange={(e: any) => {
              const v = parseInt(e.currentTarget.value)
              this.setState({ chainId: v || null })
              if (v) provider.switchNetwork(v)
            }}
          >
            <option value="">Select chain</option>
            {CHAINS.map((c) => (
              <option value={c.id}>{c.name}</option>
            ))}
          </select>

          <label>
            Contract name <small>(permanent, max 20 chars)</small>
          </label>
          <input type="text" maxLength={20} value={contractName} onInput={(e: any) => this.setState({ contractName: e.target.value })} />

          <label>
            <input type="checkbox" checked={accepted} onClick={(e: any) => this.setState({ accepted: e.currentTarget.checked })} /> I own or have rights to this collection and agree to the <a href="/terms">terms</a>
          </label>

          {error && <p style="color:red">{error}</p>}

          <button disabled={deploying || !accepted || !chainId || !contractName.trim()} onClick={() => this.deploy()}>
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
        </article>
      </section>
    )
  }
}
