import { Component } from 'preact'
import { isLocal } from '../../../../common/helpers/detector'
import { handleTransaction } from '../../helpers/transfer-collectible'
import { app, AppEvent } from '../../state'
import { AssetType } from '../Editable/editable'
import EditableDescription from '../Editable/editable-description'
import LoadingIcon from '../loading-icon'
import Modal from '../modal'
import Panel, { PanelType } from '../panel'
import Pagination from '../pagination'
import { Contract } from 'ethers'
import { CollectibleRecord } from '../../../../common/messages/collectibles'
import { web3ExtractErrorMessage } from '../../../../common/helpers/utils'
import type { gasFeeDataResponse } from '../../../../common/helpers/apis'
import { Collection } from '../../../../common/helpers/collections-helpers'
import { SUPPORTED_CHAINS_BY_ID } from '../../../../common/helpers/chain-helpers'
import config from '../../../../common/config'
import { AbiCoder, dataSlice } from 'ethers'
const defaultAbiCoder = AbiCoder.defaultAbiCoder()
import { provider } from '../../auth/state-login'
import { getTransactionLink } from '../../helpers/transaction-helpers'

enum MintingStep {
  NONE,
  MINTING,
  SAVING,
}

interface Props {
  collection: Collection
}

interface State {
  wearables?: CollectibleRecord[]
  hasURI: boolean
  validNetwork: boolean
  page: number
  total: number
}

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const collectibleContract = require('../../../../common/contracts/collectibles.json') // edit later

const PAGE_LIMIT = 50
export default class CollectionSubmissionsAdmin extends Component<Props, State> {
  contract: Contract | undefined = undefined

  constructor() {
    super()

    this.state = {
      wearables: [],
      hasURI: true,
      validNetwork: true,
      page: 1,
      total: 1,
    }
  }

  get canPublicSubmit() {
    return !!this.props.collection.settings && this.props.collection.settings.canPublicSubmit
  }

  get isMod() {
    if (!app.signedIn) {
      return false
    }
    return app.state.moderator
  }

  get isOwner() {
    if (!app.signedIn) {
      return false
    }
    return this.props.collection.owner!.toLowerCase() == app.state.wallet?.toLowerCase()
  }

  setStateAsync(state: Partial<State>): Promise<void> {
    return new Promise((resolve) => {
      this.setState(state, resolve)
    })
  }

  onProviderMessage = () => {
    provider.refreshProvider().then(() => {
      this.checkValidNetwork()
      this.setupContract()
    })
  }

  async componentDidMount() {
    app.on(AppEvent.ProviderMessage, this.onProviderMessage)
    this.fetchSubmitted()
    await provider.refreshProvider()
    await this.checkValidNetwork()
  }

  componentDidUpdate(prevProps: any, prevState: State) {
    if (this.state.page !== prevState.page) {
      this.fetchSubmitted()
    }
  }

  componentWillUnmount() {
    app.removeListener(AppEvent.ProviderMessage, this.onProviderMessage)
  }

  fetchSubmitted = (cachebust = false) => {
    const body = { collection_id: this.props.collection.id }
    let url = `${process.env.API}/collections/collectibles/review/${app.state.wallet}.json`

    if (this.isOwner || this.isMod) {
      url = `${process.env.API}/collections/collectibles/review.json`
    }
    url += `?limit=${PAGE_LIMIT}&page=${this.state.page! - 1}`
    if (cachebust) {
      url += `&cb=${Date.now()}`
    }
    fetch(url, { credentials: 'include', method: 'POST', body: JSON.stringify(body), headers })
      .then((r) => r.json())
      .then((r) => {
        const wearables = r.collectibles
        const total = r.total
        this.setState({ wearables, total })
      })
  }

  setupContract = async (): Promise<Contract | null> => {
    const isValid = await this.checkValidNetwork()
    if (!isValid) {
      provider.switchNetwork(this.props.collection.chainid ?? 1, this.setupContract.bind(this))
      return null
    }
    if (this.contract) {
      return this.contract
    }
    const signer = provider.getSigner()

    this.contract = new Contract(this.props.collection.address || '', collectibleContract.abi, signer)
    return this.contract
  }

  async checkValidNetwork() {
    const chainid = await provider.getChainId()
    const valid = chainid == this.props.collection.chainid
    // chainid 0 is off-chain; so if invalid network, check if the chainid is 0
    await this.setStateAsync({ validNetwork: valid || this.props.collection.chainid == 0 })
    return valid
  }

  setpage = async (page: number) => {
    this.setState({ page })
  }

  render({}: any, { validNetwork }: State) {
    const wearables = this.state.wearables?.map((c) => (
      <CollectibleSubmission
        setupContract={this.setupContract}
        collection={this.props.collection}
        key={c.id}
        wearable={c}
        isCollectionOwner={this.isOwner || this.isMod}
        refresh={this.fetchSubmitted}
        refreshCB={() => {
          this.fetchSubmitted(true)
        }}
      />
    ))
    return (
      <section>
        <br />
        <div style="display:flex">
          <div style="flex-grow:1">
            <h3>Wearable submissions</h3>
            <p>Manage your wearable submissions</p>
          </div>
          <div>
            <button style="margin:auto 1px" onClick={() => this.fetchSubmitted(true)}>
              Refresh
            </button>
          </div>
        </div>
        {!!validNetwork && this.state.total > PAGE_LIMIT && <Pagination callback={this.setpage} total={this.state.total} page={this.state.page} perPage={PAGE_LIMIT} />}
        {!validNetwork ? (
          <div>
            <button style={{ cursor: 'pointer', padding: '5px' }} onClick={() => provider.switchNetwork(this.props.collection.chainid ?? 1)}>
              Switch Network to view submissions!
            </button>
          </div>
        ) : (
          <table>
            <tr>
              <th>Token #</th>
              <th>Preview</th>
              <th>Description</th>
              <th>Owner</th>
              <th>Attributes</th>
              <th>Actions</th>
            </tr>
            {wearables}
          </table>
        )}
        {!!validNetwork && this.state.total > PAGE_LIMIT && <Pagination callback={this.setpage} total={this.state.total} page={this.state.page} perPage={PAGE_LIMIT} />}
        {this.state.total == 0 && <Panel type={PanelType.Info}> No submissions to be reviewed </Panel>}
      </section>
    )
  }
}

interface WearableProps {
  setupContract: () => Promise<Contract | null>
  collection?: any
  wearable: CollectibleRecord
  isCollectionOwner?: boolean
  refresh?: () => void
  refreshCB?: () => void
  remove?: Function
}

interface WearableState {
  minted?: boolean
  minting?: boolean
  step?: MintingStep
  owner?: string
  token_id?: number
  plagiarised?: CollectibleRecord
  loading?: boolean
  showRefreshGifModal?: boolean
  hash: string
}

class CollectibleSubmission extends Component<WearableProps, WearableState> {
  src: string = undefined!
  imgLoaded: boolean = undefined!
  img: HTMLImageElement = undefined!

  constructor(props: WearableProps) {
    super(props)

    this.state = {
      minted: false,
      minting: false,
      step: MintingStep.NONE,
      loading: false,
      showRefreshGifModal: false,
      hash: null!,
    }
  }

  get isOffChainCollectible() {
    return this.props.collection.chainid == 0
  }

  get isOwner() {
    if (!app.signedIn) {
      return false
    }
    return this.props.wearable.author?.toLowerCase() == app.state.wallet?.toLowerCase()
  }

  componentDidMount() {
    this.validateModel()
    this.img.onload = this.imageHasLoaded
  }

  imageHasLoaded = (e: Event) => {
    const i = e.currentTarget as HTMLImageElement
    this.imgLoaded = i.complete && i.naturalHeight !== 0
  }

  validateModel() {
    if (!this.props.wearable) {
      return
    }
    const body = JSON.stringify({ id: this.props.wearable.id, hash: this.props.wearable.hash, owner: this.props.wearable.author })

    return fetch(`/api/collectibles/w/validate-hash`, {
      headers,
      method: 'post',
      body,
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          this.setState({ plagiarised: r.collectible })
        }
      })
  }

  mint = async () => {
    if (!this.imgLoaded && !isLocal()) {
      alert('Gif has not been generated, refresh it or please wait a bit longer.')
      this.refreshGif()
      return
    }
    const chainid = await provider.getChainId()
    // chainid 0 is off-chain; so if invalid network, check if the chainid is 0
    if (chainid != this.props.collection.chainid && !this.isOffChainCollectible) {
      provider.switchNetwork(this.props.collection.chainid, this.mint.bind(this))
      return
    }
    if (!!this.state.plagiarised) {
      alert('This model is too similar to another already minted!')
      return
    }

    if (this.isOffChainCollectible) {
      // DONT MINT CAUSE YOU CANT MINT AN OFF CHAIN WEARABLE
      this.setState({ minting: true, token_id: undefined, hash: undefined, step: MintingStep.MINTING })
      await this.acceptOffChainCollectible()
      return
    }

    const contract = await this.props.setupContract()
    if (!contract) {
      app.showSnackbar('Could not generate contract, please try again')
      return
    }

    this.setState({ minting: true, token_id: undefined, hash: undefined, step: MintingStep.MINTING })

    /*
        mint function in ABI

        function mint(
        address _to,
        uint256 _quantity,
        bytes memory _data
      )

      */

    let tx, txConfirmed

    ////////////// This small few lines are to guarantee that the minting is done smoothly on polygon
    let gasInfo: gasFeeDataResponse = undefined!
    if (this.props.collection.chainid != 1) {
      // TODO fixme: fetchPolygonGasData removed, gas info skipped
    } else {
      const feeInfo = await provider.ethersWeb3Provider().getFeeData()
      if (feeInfo && feeInfo.maxFeePerGas && feeInfo.maxPriorityFeePerGas) {
        gasInfo = {
          maxPriorityFeePerGas: feeInfo.maxPriorityFeePerGas,
          maxFeePerGas: feeInfo.maxFeePerGas,
        }
      }
    }

    try {
      tx = await contract.mint(this.props.wearable.author, this.props.wearable.issues, [], gasInfo ? { ...gasInfo } : undefined)
    } catch (e: any) {
      console.error('error:', e)
      console.info('tx: ', tx)
      app.showSnackbar(web3ExtractErrorMessage(e), PanelType.Danger)
      this.setState({ minting: false, step: MintingStep.NONE })
      window.onbeforeunload = null
      return
    }

    this.setState({ hash: tx.hash })

    try {
      txConfirmed = await handleTransaction(tx)
      this.setState({ hash: txConfirmed.transactionHash })
    } catch (e: any) {
      console.error('error:', e)
      console.info('txC: ', txConfirmed)
      app.showSnackbar(web3ExtractErrorMessage(e), PanelType.Danger)
      window.onbeforeunload = null
      this.setState({ minting: false, step: MintingStep.NONE })
      return
    }

    if (txConfirmed.status == 1) {
      //success
      let token_id

      // Check if we have an events attribute
      if ((txConfirmed as any).events) {
        const eventURI = (txConfirmed as any).events.find((e: any) => e.event == 'TransferSingle')
        if (eventURI) {
          token_id = eventURI.args[3].toNumber()
        }
      }
      // IF nothing, check if we have logs.
      if (!token_id && !!txConfirmed.logs[0]) {
        let data
        try {
          data = defaultAbiCoder.decode(['bytes32', 'bytes32'], dataSlice(txConfirmed.logs[0].data, 0))
        } catch (e) {}

        if (data && !!data[0]) {
          token_id = parseInt(data[0], 16) //data[0] is the token_id, data[1] would be the quantity
        }
      }

      if (token_id) {
        // We have a token_id
        this.setState({ token_id, minting: false, step: MintingStep.SAVING }, () => {
          this.save()
        })
      } else {
        // We failed to obtain a token_id
        app.showSnackbar(`❌ Error, wearable was minted but not saved, please report!`, PanelType.Danger)
        console.error('error:', txConfirmed)
        this.setState({ minted: false })
      }
    } else {
      //failure
      console.error('error:', txConfirmed)
      this.setState({ minted: false })
      app.showSnackbar(`❌ Error, Transaction failed!`, PanelType.Danger)
    }
    window.onbeforeunload = null
  }

  remove() {
    if (!confirm('Are you sure you want to remove this wearable?')) {
      return
    }
    this.setState({ loading: true })
    fetch(`/api/collectibles/w/${this.props.wearable.id}/delete`, { headers, method: 'POST' })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          app.showSnackbar('✅ ' + this.props.wearable.id + ' was removed', PanelType.Success)
          this.props.refreshCB?.()
        } else {
          app.showSnackbar(r.message || '❌ Could not remove', PanelType.Danger)
        }
        this.setState({ loading: false })
      })
  }

  save() {
    const body = JSON.stringify({
      collection_id: this.props.wearable.collection_id,
      token_id: this.state.token_id,
      image: this.img.src,
    })

    return fetch(`/api/collectibles/w/${this.props.wearable.id}/update`, { credentials: 'include', method: 'POST', body, headers })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          this.setState({ minted: true, step: MintingStep.NONE }, () => {
            app.showSnackbar(`✅ Set token id for ${this.props.wearable.name} as ${this.state.token_id}!`, PanelType.Success)
          })
        } else {
          app.showSnackbar('Something went wrong', PanelType.Danger)
          alert(r.message ? r.message + ' Please, report.' : `Your model (token_id: ${this.state.token_id}) was minted, but not saved on the database; Please report.`)
          this.setState({ minted: false, step: MintingStep.NONE })
        }
      })
  }

  async refreshGif() {
    this.setState({ showRefreshGifModal: true }, () => {
      setTimeout(() => {
        this.closeModal()
      }, 5000)
    })
  }

  closeModal = () => {
    this.setState({ showRefreshGifModal: false })
    this.img.src = this.img.src.match(/(\?t)/) ? this.img.src.split('?')[0] + `?t=${Date.now()}` : `${this.img.src}?t=${Date.now()}`
  }

  render() {
    const src = config.wearablePreviewURL(this.props.wearable.id, this.props.wearable.name)
    const etherscan = `https://www.voxels.com/avatar/${this.props.wearable.author}`
    const url = `/collections/${SUPPORTED_CHAINS_BY_ID[this.props.collection.chainid]}/${this.props.collection.address}/${this.state.token_id}`

    const attributes = this.props.wearable.custom_attributes?.length
      ? this.props.wearable.custom_attributes
          .filter((a) => !a.ignore)
          .map((a) => {
            return (
              <li>
                {a.trait_type}: {a.value}
              </li>
            )
          })
      : []
    attributes.push(<li>Issues: {this.props.wearable.issues}</li>)
    return (
      <tr key={this.props.wearable.id}>
        <td>{this.props.wearable.id}</td>
        <td>
          <img
            src={src}
            ref={(c) => {
              this.img = c!
            }}
            id={`wearable-${this.props.wearable.id}`}
            style={{ width: 150, height: 150 }}
          />
        </td>
        <td>
          <b>{this.props.wearable.name}</b>

          <br />
          <EditableDescription onSave={this.props.refresh} value={this.props.wearable.description} isowner={this.isOwner} type={AssetType.Collectible} data={this.props.wearable} title="Description of this collectible" />
          <br />
          <span>Category: {this.props.wearable.category}</span>
        </td>
        <td>
          {this.props.wearable.author && (
            <a title={this.props.wearable.author} href={etherscan}>
              {this.props.wearable.author_name || this.props.wearable.author.slice(0, 5) + '...'}
            </a>
          )}
        </td>
        <td>
          <ul>{attributes.length > 0 ? attributes : 'none'}</ul>
        </td>
        <td colSpan={2}>
          <div style="display:flex; flex-direction: column;">
            {!!this.state.plagiarised ? (
              <div>
                <Panel type="danger">
                  This wearable is too similar to another{' '}
                  <a href={`/collections/${SUPPORTED_CHAINS_BY_ID[this.state.plagiarised.chain_id ?? 1]}/${this.state.plagiarised.collection_address}/${this.state.plagiarised.token_id}`} target="_blank">
                    Wearable already minted!
                  </a>
                </Panel>
              </div>
            ) : this.props.isCollectionOwner ? (
              this.state.minted ? (
                <a href={url} target="_blank">
                  Collectible ready
                </a>
              ) : !this.state.minted && this.state.minting ? (
                'Minting...'
              ) : (
                !this.state.loading && <MintButton isOffChainCollectible={this.isOffChainCollectible} mint={this.mint} />
              )
            ) : (
              'Item being reviewed'
            )}
            {(this.props.isCollectionOwner || this.isOwner) && <button onClick={() => this.refreshGif()}>Refresh preview</button>}
            {!this.state.minted &&
              (this.state.loading ? (
                'Saving...'
              ) : (
                <button onClick={() => this.remove()} title="Fully delete the submission">
                  Remove
                </button>
              ))}
          </div>
        </td>
        <AwaitTransaction step={this.state.step!} token_id={this.state.token_id!} hash={this.state.hash} chainId={this.props.collection.chainid} />
        <ShowRefreshGifModal showRefreshGifModal={this.state.showRefreshGifModal!} uuid={this.props.wearable.id!} onClose={this.closeModal} />
      </tr>
    )
  }

  private async acceptOffChainCollectible() {
    const body = JSON.stringify({
      collection_id: this.props.wearable.collection_id,
      isOffChain: true, // Tell the backend this is an off-chain wearable
      token_id: 0, // Needed so the backend knows we're updating the token_id;
      image: this.img.src,
    })

    fetch(`/api/collectibles/w/${this.props.wearable.id}/update`, { credentials: 'include', method: 'POST', body, headers })
      .then((r) => r.json())
      .then((r: { success: boolean; token_id?: number; message?: string }) => {
        if (r.success && r.token_id) {
          // Set the token id
          this.setState({ minted: true, step: MintingStep.NONE, token_id: r.token_id }, () => {
            app.showSnackbar(`✅ Set token id for ${this.props.wearable.name} as ${this.state.token_id}!`, PanelType.Success)
          })
        } else {
          app.showSnackbar('Something went wrong', PanelType.Danger)
          alert(r.message ? r.message : `Could not save on the database; Please report.`)
          this.setState({ minted: false, step: MintingStep.NONE })
        }
        this.setState({ minting: false })
      })
  }
}

function MintButton({ isOffChainCollectible, mint }: { isOffChainCollectible: boolean; mint: () => void }) {
  return <button onClick={mint}>{isOffChainCollectible ? `Accept` : `Mint`}</button>
}

export function AwaitTransaction(props: { token_id: number; hash: string; chainId: number; step: MintingStep }) {
  const { hash, step, chainId, token_id } = props
  const shouldRender = step != MintingStep.NONE

  const transactionLink = hash ? getTransactionLink(chainId, hash) : ''

  if (!shouldRender) {
    return null
  }
  return (
    <Modal>
      {step == MintingStep.MINTING && <h1>Awaiting confirmation...</h1>}
      {step == MintingStep.SAVING && <h1>Saving Wearable...</h1>}
      <div>
        <LoadingIcon />
        <small>
          <strong>Please do not leave the page.</strong>
        </small>
        <small>Minting can take a while. Even when your provider confirms the transaction it's important you don't leave the page or your wearable won't save properly.</small>
        {step == MintingStep.SAVING && token_id && <small>Your wearable was minted as #{token_id}, we're now updating...</small>}
      </div>
      <p>
        {hash && (
          <a href={transactionLink} target="_blank">
            View transaction on explorer.
          </a>
        )}
      </p>
    </Modal>
  )
}

export function ShowRefreshGifModal(props: { showRefreshGifModal: boolean; uuid: string; onClose: () => void }) {
  if (!props.showRefreshGifModal) {
    return null
  }
  return (
    <Modal>
      <div onClick={props.onClose}>X</div>
      <h2>Loading...</h2>
      <iframe src={`https://costumer.crvox.com/add/?id=${props.uuid}`} scrolling="false" frameBorder={0} width={140}></iframe>
      <div>
        <b>What does it mean?</b>
        <p>
          <ul>
            <li>
              <b>"ok"</b>: Means the wearable is valid and the gif is being generated; wait a few minutes and refresh the page.
            </li>
            <li>
              <b>"not ok"</b>: Means the wearable is not valid; will not generate.
            </li>
          </ul>
        </p>
        <Panel type="info">
          If the iframe above does not work;{' '}
          <a href={`https://costumer.crvox.com/add/?id=${props.uuid}`} target="_blank">
            click here
          </a>
        </Panel>
      </div>
    </Modal>
  )
}
