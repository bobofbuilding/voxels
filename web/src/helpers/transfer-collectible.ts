import { Contract, Signer } from 'ethers'
import { isAddress } from 'ethers'
import { ChainID, Ethereum, Polygon, SUPPORTED_CHAINS_BY_ID, supportedChainsIds } from '../../../common/helpers/chain-helpers'
import { provider } from '../auth/state-login'
import { app } from '../state'
import { fetchAPI } from '../utils'

export const BATCH_TRANSFER_MATIC = '0x0c14093400f5de3de7326a9a7f49dcc53d6a9d0b'
export const BATCH_TRANSFER_ETH = '0x9be54b221c44e8665c88af8bb1a99189a1f0e80a'

let batchTransferABI: any = null
const BATCH_TRANSFER_contract = (signer: Signer, chain: ChainID) => {
  let address
  if (chain === Ethereum) {
    address = BATCH_TRANSFER_ETH
  } else if (chain === Polygon) {
    address = BATCH_TRANSFER_MATIC
  } else {
    throw new Error(`chain id ${chain} does not support batch transfer`)
  }
  if (!batchTransferABI) batchTransferABI = require('../../../common/contracts/batchTransfer.json')
  return new Contract(address, batchTransferABI, signer)
}
const collectibleContract = require('../../../common/contracts/collectibles-v2.json')

export type NFTTransferState = {
  state: 'network-switching' | 'approving-contract' | 'confirming' | 'transferring' | 'transferred'
  step: number
  totalSteps: number
  hash?: string
}

export type TransferableNFT = {
  token_id?: string | number
  collection_address?: string | null
  chain_id?: ChainID
}

export class TransferCollectibleHelper {
  protected _balance: number | null = null

  /* Get the balance from the blockchain */
  async getBalance(collectible: TransferableNFT, cacheBust = false) {
    if (!collectible.chain_id) throw new Error(`chain id '${collectible.chain_id}' is invalid`)
    this._balance = null
    if (app?.signedIn) {
      let url = `/api/collectibles/w/${SUPPORTED_CHAINS_BY_ID[collectible.chain_id]}/${collectible.collection_address}/${collectible.token_id}/balanceof/${app.state.wallet}`
      if (cacheBust) url += `?cb=${Date.now()}`
      const r = await fetchAPI(url)
      if (r.success && r.balance) this._balance = r.balance
    }
    return this._balance
  }

  async *startTransfer(collectible: TransferableNFT, receiver: string, amount = 1): AsyncIterableIterator<NFTTransferState> {
    if (!this._balance) await this.getBalance(collectible)

    const { chainID, address, receivers, tokenID, quantity } = await this.validate(collectible, [receiver], amount)

    let step = 1
    let totalSteps = 3

    const isCorrectChain = (await provider.getChainId()) === chainID
    if (!isCorrectChain) {
      totalSteps++
      // attempt to switch network
      yield { state: 'network-switching', step: step++, totalSteps: totalSteps }
      const switched = await provider.switchNetwork(chainID)
      if (!switched) {
        throw new Error('Could not change network')
      }
    }

    const contract = new Contract(address, collectibleContract.abi, provider.getSigner())
    yield { state: 'confirming', step: step++, totalSteps: totalSteps }
    const transaction = await contract.safeTransferFrom(app.state.wallet, receivers[0], tokenID, quantity, [])

    yield { state: 'transferring', hash: transaction.hash, step: step++, totalSteps: totalSteps }
    const txConfirmed = await transaction.wait(1) //wait at least 2 blocks to confirm.
    if (txConfirmed.status !== 1) throw new Error('Error, transaction failed')

    if (this._balance) this._balance -= quantity

    yield { state: 'transferred', step: step++, totalSteps: totalSteps }
  }

  protected async validate(collectible: TransferableNFT, receivers: string[], quantity: number) {
    if (!collectible.chain_id) {
      throw new Error(`Collectible chain_id '${collectible.chain_id}' is invalid`)
    }

    if (!supportedChainsIds.includes(collectible.chain_id)) {
      throw new Error(`Collectible chain_id '${collectible.chain_id}' is not supported`)
    }

    if (!collectible.collection_address) {
      throw new Error('Collectible address is invalid')
    }

    if (!collectible.token_id || isNaN(Number(collectible.token_id)) || Number(collectible.token_id) <= 0) {
      throw new Error('Collectible id is invalid')
    }

    const toAddresses = receivers.filter((p) => isAddress(p))
    if (toAddresses.length !== receivers.length) {
      throw new Error(`${receivers.length - toAddresses.length} of the addresses entered is invalid`)
    }

    if (this._balance === null) {
      throw new Error("Can't find balance")
    }

    if (!quantity || quantity <= 0 || quantity > this._balance) {
      throw new Error(`Can't transfer bad quantity ${quantity}`)
    }

    return {
      chainID: collectible.chain_id,
      address: collectible.collection_address,
      tokenID: Number(collectible.token_id),
      receivers: toAddresses,
      quantity: Number(quantity),
    }
  }
}

export class BatchTransferWrapper extends TransferCollectibleHelper {
  private _chain_id: ChainID = 1
  private _contract: Contract | null = null

  async *transfer(collectible: TransferableNFT, toAddresses: string[]): AsyncIterableIterator<NFTTransferState> {
    if (!this._balance) await this.getBalance(collectible)
    const { chainID, address, receivers, tokenID } = await this.validate(collectible, toAddresses, 1)

    this._chain_id = chainID
    let step = 1
    const totalSteps = 5

    yield { state: 'network-switching', step: step++, totalSteps: totalSteps }

    const isCorrectChain = (await provider.getChainId()) === chainID
    if (!isCorrectChain) {
      // attempt to switch network
      const switched = await provider.switchNetwork(chainID)
      if (!switched) {
        throw new Error('Could not change network')
      }
    }

    this._contract = BATCH_TRANSFER_contract(provider.getSigner(), chainID)
    if (!this._contract) {
      throw new Error('transfer contract could not be loaded')
    }

    yield { state: 'approving-contract', step: step++, totalSteps: totalSteps }
    await this.approveContract(collectible)

    const gasInfo = await provider.ethersWeb3Provider().getFeeData()
    if (!gasInfo?.gasPrice) {
      console.error('Gas info not found')
    }

    yield { state: 'confirming', step: step++, totalSteps: totalSteps }
    const transaction = await this._contract.batchTransfer_singleTokenToMultipleDest(address, tokenID, receivers, gasInfo ? { gasPrice: gasInfo.gasPrice } : undefined)

    yield { state: 'transferring', hash: transaction.hash, step: step++, totalSteps: totalSteps }
    const txConfirmed = await transaction.wait(1) //wait at least 2 blocks to confirm.
    if (txConfirmed.status !== 1) throw new Error('Error, transaction failed')

    yield { state: 'transferred', step: step++, totalSteps: totalSteps }
  }

  async isApproved(collectible: TransferableNFT): Promise<boolean> {
    const { contract, address } = await this.getContractAndAddress(collectible)
    return await contract.isApprovedForAll(address)
  }

  // returns state of the contract approval
  approveContract = async (collectible: TransferableNFT) => {
    const { contract, address } = await this.getContractAndAddress(collectible)
    const isApproved = await contract.isApprovedForAll(address)
    if (isApproved) return
    await this.setApproval(contract, address, true)
  }

  // returns state of the contract approval
  revokeApproval = async (collectible: TransferableNFT) => {
    const { contract, address } = await this.getContractAndAddress(collectible)
    const isApproved = await contract.isApprovedForAll(address)
    if (!isApproved) return
    await this.setApproval(contract, address, false)
  }

  setApproval = async (contract: Contract, address: string, approve: boolean) => {
    const abi = [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'operator',
            type: 'address',
          },
          {
            internalType: 'bool',
            name: 'approved',
            type: 'bool',
          },
        ],
        name: 'setApprovalForAll',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ]
    const approvalContract = new Contract(address, abi, provider.getSigner())
    const gasInfo = await provider.ethersWeb3Provider()?.getFeeData()
    const approvalTX = await approvalContract.setApprovalForAll(contract.address, approve, gasInfo ? { gasPrice: gasInfo.gasPrice } : undefined)
    await handleTransaction(approvalTX)
    return true
  }

  private getContractAndAddress = async (collectible: TransferableNFT) => {
    if (!collectible.chain_id) throw new Error('no chain id found')
    const contract = BATCH_TRANSFER_contract(provider.getSigner(), collectible.chain_id)
    if (!collectible.collection_address || !(await isAddressAContract(collectible.collection_address))) {
      throw new Error(`collectible address '${collectible.collection_address}' is not a valid contract`)
    }

    return { contract: contract, address: collectible.collection_address }
  }
}

type txError = {
  hash?: string
  reason?: 'repriced' | 'cancelled' | 'replaced'
  cancelled?: boolean
  replacement?: any
  receipt?: any
}

export async function handleTransaction(transaction: any) {
  const awaitTransaction = async (trans: any) => {
    let tx: any
    try {
      tx = await trans.wait(1)
    } catch (error: any) {
      const e = error as txError
      if ((e.reason == 'replaced' || e.reason == 'repriced') && e.replacement) {
        tx = await awaitTransaction(e.replacement)
      } else if (e.reason == 'cancelled') {
        throw new Error('Transaction cancelled')
      } else {
        throw new Error(e.reason ?? e?.toString())
      }
    }
    return tx
  }

  return await awaitTransaction(transaction)
}

export async function isAddressAContract(address: string): Promise<boolean> {
  const ethProvider = provider.ethersWeb3Provider()
  if (!ethProvider) {
    return false
  }
  let p
  try {
    p = await ethProvider.getCode(address)
  } catch (e) {
    return true // safe
  }
  return p !== `0x`
}
