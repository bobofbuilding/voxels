import { Component, Fragment } from 'preact'
import { resizeAndCallback } from './helpers/collections-helper'
import { app, AppEvent } from './state'
import Panel, { PanelType } from './components/panel'
import LoadingIcon from './components/loading-icon'
import { fetchOptions } from './utils'
import { handleTransaction } from './helpers/transfer-collectible'
import { convertDataURItoJPGFile, getExtensionFromDatarUrl, uploadMedia } from '../../common/helpers/upload-media'
import { ContractTypes } from '../../common/helpers/collections-helpers'
import { SUPPORTED_CHAINS_BY_ID } from '../../common/helpers/chain-helpers'
import { gasFeeDataResponse } from '../../common/helpers/apis'
import { web3ExtractErrorMessage } from '../../common/helpers/utils'
import { Contract, ContractFactory } from 'ethers'
import { isAddress } from 'ethers'
import { provider } from './auth/state-login'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const collectionFactoryContract = require('../../common/contracts/collections-factory.json')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const collectiblesContract = require('../../common/contracts/collectibles-v2.json')

export interface Collection {
  id?: any
  name?: string
  description?: string
  owner?: string
  address?: string
  chainId?: number
  collectiblesType?: string
  image_url?: string | null
  slug?: string
  type?: ContractTypes
}

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

export interface optionalProps {
  collection?: Collection
}

export default class CreateCollection extends Component<optionalProps, Collection> {
  canvas: HTMLCanvasElement = undefined!
  img: HTMLImageElement = undefined!

  constructor(props: any) {
    super()

    this.state = props.collection || {
      name: '',
      address: null,
      description: '',
      owner: null,
      image_url: null,
      chainId: null,
      collectiblesType: 'wearables',
      slug: null,
      type: ContractTypes.ERC1155,
    }
  }

  get isOnStepOne() {
    return !this.state.chainId
  }

  get isOnStepTwo() {
    return !this.state.name || !this.state.slug
  }

  get isOnStepThree() {
    return !this.state.address
  }

  clear() {
    this.setState({
      name: '',
      address: null!,
      description: '',
      owner: null!,
      image_url: null,
      chainId: null!,
      collectiblesType: 'wearables',
      slug: null!,
      type: ContractTypes.ERC1155,
    })
  }

  componentWillUnmount() {
    this.clear()
  }

  nextStage(object: any) {
    this.setState(object)
  }

  render() {
    return (
      <div>
        {this.isOnStepOne ? (
          <StepOneCollectionSelectChain nextStage={this.nextStage.bind(this)} />
        ) : this.isOnStepTwo ? (
          <StepTwoCollectionMinimumInfo chainId={this.state.chainId} nextStage={this.nextStage.bind(this)} />
        ) : this.isOnStepThree ? (
          <StepThreeCollectionUploadAndDeploy collection={this.state} nextStage={this.nextStage.bind(this)} />
        ) : (
          <StepFourCreationSuccess collection={this.state} />
        )}
      </div>
    )
  }
}

interface stepOneState {
  chainId: number
  gas: number
  price: number
  usdPrice: number
  fetching: boolean
  correctChain: boolean
  getEstimate: boolean
}

class StepOneCollectionSelectChain extends Component<any, stepOneState> {
  constructor() {
    super()

    this.state = {
      chainId: 137,
      gas: 0.0,
      price: null!,
      usdPrice: null!,
      fetching: false,
      correctChain: true,
      getEstimate: false,
    }
  }

  get selectedChain() {
    return this.state.chainId
  }

  get chainToken() {
    return this.state.chainId == 1 ? 'Eth' : this.state.chainId == 137 ? 'Polygon' : 'Matic Mumbai'
  }

  onProviderMessage = () => {
    this.checkChain()
  }

  componentDidMount() {
    this.checkChain()
    app.on(AppEvent.ProviderMessage, this.onProviderMessage)
  }

  componentWillUnmount() {
    app.removeListener(AppEvent.ProviderMessage, this.onProviderMessage)
  }

  async componentDidUpdate(prevProps: any, prevState: any) {
    if (prevState.chainId != this.state.chainId) {
      this.checkChain()
    }
  }

  async checkChain() {
    if (!provider.signer) {
      console.warn('No signer')
      return
    }
    const chainid = await (provider.signer as any).getChainId()
    this.setState({ correctChain: chainid == this.state.chainId })
  }

  selectChain(value: any) {
    if (!value) {
      return
    }
    this.setState({ chainId: parseInt(value) }, () => {
      this.state.getEstimate && this.estimateGas()
    })
  }

  async getContract(): Promise<Contract> {
    const signer = provider.getSigner()
    const contract_address = this.selectedChain == 137 ? process.env.COLLECTION_FACTORY_CONTRACT_MATIC : process.env.COLLECTION_FACTORY_CONTRACT_ETH
    return new Contract(contract_address!, collectionFactoryContract.abi, signer)
  }

  async getFactoryTransactionGas(): Promise<number> {
    const signer = provider.getSigner()
    const factory = new ContractFactory(collectiblesContract.abi, collectiblesContract.bytecode, signer)
    const deploy = await factory.getDeployTransaction('https://www.voxels.com/c/2500/{id}', 'a_name', { gasLimit: 10e6 })
    const estimateDeploy = await signer.provider!.estimateGas(deploy as any)
    return estimateDeploy ? Number(estimateDeploy) * 10e-8 : 0.0
  }

  async estimateGas() {
    this.setState({ fetching: true })
    const res = await provider.switchNetwork(this.state.chainId)
    if (!res) {
      return
    }
    const contract = await this.getContract()
    // Get gas cost of dealing with the factory
    const launchGasEstimate = await (contract as any).launchCollection.estimateGas(9500, 'a_name', { gasLimit: 10e6 })
    const gasLaunch = launchGasEstimate ? Number(launchGasEstimate) * 10e-8 : 0.0
    // Get gas cost of dealing with the deploy of the contract.
    const deployTransactionGas = await this.getFactoryTransactionGas()
    const gas = gasLaunch + deployTransactionGas
    this.setState({ gas })
    this.estimateGasPrice()
  }

  async estimateGasPrice() {
    if (!provider.signer) {
      return
    }
    const feeData = await provider.ethersWeb3Provider().getFeeData()
    const price = feeData.gasPrice
    const p = price ? Number(price) / 10 ** 9 : 0.0
    this.setState({ price: p, fetching: false })
    this.fetchUSDPrice()
  }

  fetchUSDPrice() {
    fetch(`https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=EOS,USD,EUR`, fetchOptions())
      .then((r) => r.json())
      .then((response) => {
        if (response) {
          this.setState({ usdPrice: response.USD })
        }
      })
  }

  nextStage() {
    if (!this.state.chainId) {
      return
    }
    provider.switchNetwork(this.state.chainId)
    this.props.nextStage({ chainId: this.state.chainId })
  }

  render() {
    const selectChainIdOptions = chainIds().map((c) => {
      return <option value={c.id}>{c.name}</option>
    })

    return (
      <div>
        <h3>Step 1: Select a chain</h3>
        <p>Select the blockchain where your collection's smart contract is deployed.</p>

        <div>
          <label>Chain</label>
          <select value={this.state.chainId} onChange={(e) => this.selectChain(e.currentTarget['value'])}>
            <option value={null!}></option>
            {selectChainIdOptions}
          </select>

          <br />

          <ul>
            <li>
              <b>Ethereum</b> is a fast and widely used network for high value NFTs, but transactions can be expensive.
            </li>
            <li>
              <b>Polygon</b> is a fast and cheap network.
            </li>
            <li>
              <b>Mumbai</b> is the polygon test network for testing.
            </li>
          </ul>

          <p>Both Polygon and Ethereum are supported by Opensea.</p>

          {this.state.chainId && (
            <p>
              You've chosen the {chainIds().find((c) => c.id === this.state.chainId.toString())?.name} chain. Make sure you're on {chainIds().find((c) => c.id === this.state.chainId.toString())?.name} on metamask.
            </p>
          )}
          {(this.state.chainId == 137 || this.state.chainId == 80001) && (
            <Fragment>
              <p>To deploy a smart contract on Polygon (the blockchain formerly known as matic), you will need ~5 $MATIC. Follow the steps below to convert ether to matic and move it onto the polygon blockchain.</p>

              <ol>
                <li>
                  <a href="https://app.uniswap.org/#/swap">Swap - $ETH for $MATIC (using uniswap.org)</a>{' '}
                </li>

                <li>
                  <a href="https://polygonscan.com/">Polygon Scan - Polygon PoS Chain Explorer</a>{' '}
                </li>
              </ol>
            </Fragment>
          )}
        </div>
        <button disabled={!this.state.chainId} onClick={() => this.nextStage()}>
          Next
        </button>
      </div>
    )
  }
}

interface stepTwoProps {
  chainId: any
  nextStage: Function
}

class StepTwoCollectionMinimumInfo extends Component<stepTwoProps, any> {
  canvas: HTMLCanvasElement = undefined!
  img: HTMLImageElement = undefined!

  constructor(props: any) {
    super()

    this.state = {
      name: '',
      address: null,
      description: '',
      owner: null,
      image_url: null,
      chainId: props.chainId,
      collectiblesType: 'wearables',
      slug: null,
      type: ContractTypes.ERC1155,
      error: null,
      validating: false,

      uploadingMedia: false, // loading state for uplaoding the collection's image
    }
  }

  get isMod() {
    if (!app.signedIn) {
      return false
    }
    return app.state.moderator
  }

  get acceptedTypes(): string[] {
    //Collectibles types (for example if you want to add dance NFTs, add 'Dances')
    return ['Wearables']
  }

  onAppLoad = () => {
    this.setState({ owner: app.state.wallet })
  }

  componentDidMount() {
    this.setState({ owner: app.state.wallet })

    app.on(AppEvent.Load, this.onAppLoad)
  }

  componentWillUnmount() {
    app.removeListener(AppEvent.Load, this.onAppLoad)
  }

  async validate() {
    this.setState({ validating: true })
    const body = JSON.stringify({
      name: this.state.name,
      slug: this.state.slug.toString(),
    })

    const p = await fetch(`${process.env.API}/collections/validate` /* Whereever the api to create collections is*/, {
      headers,
      method: 'post',
      body,
    })
    const r = await p.json()
    if (r.message) {
      this.setState({ error: r.message, validating: false })
    }

    if (r.success) {
      this.nextStage()
    }
  }

  async onMediaResized(dataURL: string) {
    const extension = getExtensionFromDatarUrl(dataURL)
    const file = convertDataURItoJPGFile(dataURL, 'collection_' + Date.now() + '.' + extension)
    const upload = await uploadMedia(file) //Could be in its own "collection" folder

    if (!upload.success) {
      this.setState({ uploadingMedia: false })
      app.showSnackbar('Something went wrong while uploading your image')
      return
    }

    this.setState({ image_url: upload.location, uploadingMedia: false })
  }

  ResizeAndUpload(input: any) {
    this.setState({ uploadingMedia: true })

    const resizeFail = () => {
      this.setState({ uploadingMedia: false })
    }

    const reader = new FileReader()

    reader.onload = (e) => {
      const img = document.createElement('img') as HTMLImageElement
      img.width = 100
      img.height = 100
      if (e.target!.readyState == FileReader.DONE) {
        const ctx = this.canvas.getContext('2d')
        ctx!.clearRect(0, 0, this.canvas.width, this.canvas.height)
        img.onload = () => resizeAndCallback(this.canvas, img, this.onMediaResized.bind(this), resizeFail)
        img.src = e.target!.result as string
      }
    }

    reader.readAsDataURL(input.files[0])
  }

  nextStage() {
    this.setState({ error: null, validating: false })
    if (!app.signedIn) {
      this.setState({ error: 'You must log in first!' })
      return
    }

    if (!!this.state.uploadingMedia) {
      this.setState({ error: 'Please wait for your image to load.' })
      return
    }

    if (!this.state.name || !this.state.name.trim()) {
      this.setState({ error: 'Please give your collection a valid name.' })
      return
    }

    if (!this.state.slug || !this.state.slug.trim() || !!parseInt(this.state.slug[0], 10)) {
      this.setState({ error: 'Please give your collection a valid slug.' })
      return
    }

    // Pass basic validation.
    this.props.nextStage(this.state)
  }

  setSlug(slug: string) {
    const s = slug
      .replace(' ', '')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/#|_|<|>|\[|\]|{|}|\^|%|&|\?/g, '')
      .toLowerCase()
    this.setState({ slug: s })
  }

  render() {
    //Collectibles types
    const selectcollectiblesType = this.acceptedTypes.map((c) => {
      return <option value={c.toLowerCase()}>{c}</option>
    })

    return (
      <div>
        <h3>Step 2: Collection's information</h3>
        {this.state.error && <Panel type="danger">{this.state.error}</Panel>}
        <div>
          <label>Name*</label>
          <input type="text" name="name" onInput={(e) => this.setState({ name: (e as any).target['value'] })} value={this.state.name} />
          <br />
          <small>The name of your collection displayed in Voxels</small>
        </div>

        <div>
          <label>Description</label>
          <textarea onInput={(e) => this.setState({ description: (e as any).target['value'] })} value={this.state.description}></textarea>
        </div>

        {this.isMod && (
          <div>
            <label>Type of collectibles*</label>
            <select onChange={(e) => this.setState({ collectiblesType: e.currentTarget['value'] })}>
              <option value={null!}></option>
              {selectcollectiblesType}
            </select>
            <br />
            <small>The types of collectibles this contract will create. - Only 'wearables' are supported at the moment.</small>
          </div>
        )}

        <div>
          <label>Slug*</label>
          <input name="slug" value={this.state.slug} onInput={(e) => this.setSlug((e as any).target['value'])} type="text" />
          <br />
          <small>This makes your collection's url easier to share - The first character may not be a number. eg: </small>
          <br />
          <small> cryptovoxels.com/collections/{this.state.slug ? this.state.slug : ''}</small>
        </div>

        <div>
          <label>Collection's image</label>
          <input type="file" onChange={(e) => this.ResizeAndUpload(e.target)} />
          <br />
          {this.state.uploadingMedia && <LoadingIcon />}
        </div>

        <small>Preview:</small>
        <div>
          <div>
            <div>
              <canvas
                ref={(c) => {
                  this.canvas = c!
                }}
              ></canvas>
            </div>
            <div>
              <h3>{this.state.name}</h3>
              <p>{this.state.description}</p>
            </div>
          </div>
        </div>
        <br />

        <button disabled={!this.state.slug} onClick={() => this.validate()}>
          {this.state.validating ? `Validating...` : `Save & Next`}
        </button>
      </div>
    )
  }
}

interface UploadDeployState {
  collection: Collection
  uploading: boolean
  accepted: boolean
  uploaded: boolean
  deploying: boolean
  transaction: any
  address: string
  deployed: boolean
  error: string
  name: string
  id: number
}

class StepThreeCollectionUploadAndDeploy extends Component<any, UploadDeployState> {
  textarea: HTMLTextAreaElement = undefined!

  constructor(props: any) {
    super()

    this.state = {
      collection: props.collection,
      uploading: false,
      accepted: false,
      uploaded: !!props.collection.id,
      deploying: false,
      transaction: {},
      address: null!,
      deployed: false,
      error: null!, // Error
      name: null!, // Name of the contract on blockchain.
      id: null!, // id of new collection
    }
  }

  get collection() {
    return this.state.collection
  }

  componentDidMount() {
    this.setName(this.props.collection.name)
    if (!!this.collection?.id) {
      this.setState({ id: this.collection.id })
    }
  }

  setName(name: string) {
    const s = name.replace(/[^\x00-\x7F]/g, '').replace(/#|<|>|\[|\]|{|}|\^|%|&|\?/g, '')
    this.setState({ name: s })
  }

  async canUserAffordDeploy() {
    const amountUserHas = await this.getTokenAmount()

    return !(amountUserHas <= 0.0001)
  }

  async getTokenAmount(): Promise<number> {
    const w3 = provider.ethersWeb3Provider()
    if (!w3 || !app.state.wallet) {
      return 0
    }
    const p = await w3.getBalance(app.state.wallet)
    // 18 decimals for both matic and eth.
    return parseFloat((parseInt(p.toString()) / 10 ** 18).toString())
  }

  setTextTransaction() {
    // Set the textarea (show the transaction log to the user)
    this.textarea.value = JSON.stringify(this.state.transaction, undefined, 4)
  }

  copyToClipboard = (e: any) => {
    const input: HTMLInputElement = e.target
    input.select()
    document.execCommand('copy')
    e.target.focus()
    app.showSnackbar('Copied to clipboard!', PanelType.Success)
  }

  async uploadAndDeploy() {
    this.setState({ error: null! })
    if (!provider.signer) {
      this.setState({ error: 'Please login to continue.' })
      return
    }

    const chainid = await (provider.signer as any).getChainId()

    if (chainid != this.collection.chainId) {
      this.setState({ error: 'You are not on the right chain, please try again.' })
      provider.switchNetwork(this.collection.chainId!)
      return
    }

    const canAfford = await this.canUserAffordDeploy()
    if (!canAfford) {
      this.setState({ error: `We notice you do not own enough ${this.collection.chainId == 1 ? 'ETH' : 'MATIC'} to pay for the minting fee...` })
      return
    }

    if (!this.state.accepted) {
      this.setState({ error: 'Please accept the terms and conditions.' })
      return
    }

    if (!this.state.name || !this.state.name.trim()) {
      this.setState({ error: 'Please give your contract a name.' })
      return
    }
    !this.state.id && (await this.uploadToServer())
    await this.deploy()
  }

  async uploadToServer(): Promise<any> {
    this.setState({ uploading: true })

    const body = JSON.stringify({
      name: this.collection.name,
      description: this.collection.description,
      owner: this.collection.owner,
      image_url: this.collection.image_url,
      slug: this.collection.slug!.toString(),
      type: this.collection.type,
      chainId: this.collection.chainId,
      collectiblesType: this.collection.collectiblesType!.toLowerCase(),
    })

    const p = await fetch(`${process.env.API}/collections/create`, {
      headers,
      method: 'put',
      body,
    })
    const r = await p.json()

    if (!r.success) {
      this.setState({
        uploading: false,
        error: r.message || 'Unable to save collection, check the console for any errors and report them.',
      })
      return null
    }
    // success do something send collection id to deploy stage
    this.setState({ uploading: false, uploaded: true, id: r.collection.id })
  }

  async deploy() {
    if (!this.state.id || this.state.id == 0) {
      this.setState({ error: 'No collection Id recorded, please try again.' })
      return
    }
    this.setState({ transaction: null })

    this.setState({ deploying: true, address: null!, transaction: {} })

    const signer = provider.getSigner()
    const contract_address = this.collection.chainId == 137 ? process.env.COLLECTION_FACTORY_CONTRACT_MATIC : process.env.COLLECTION_FACTORY_CONTRACT_ETH
    const contract = new Contract(contract_address!, collectionFactoryContract.abi, signer)

    let gasInfo: gasFeeDataResponse | null = null

    // Deploy a contract with the name of the collection.
    let transaction
    try {
      transaction = await contract.launchCollection(this.state.id, this.state.name, gasInfo ? { ...(gasInfo as any) } : {})
      this.setState({ transaction: transaction })
    } catch (e: any) {
      if (e.code == 4001) {
        this.setState({ deploying: false, error: 'User refused transaction. Without a contract your collection will not work.' })
        return
      }

      this.setState({ deploying: false, error: web3ExtractErrorMessage(e) || 'Something went wrong, please report.' })
      return
    }
    // Now we listen to the blockchain for a successful transaction:
    //We use .wait().
    let tx
    try {
      tx = await handleTransaction(transaction)
      // Tx should return the address of the new collection, but I console.log it just to be sure.
    } catch (e) {
      console.log(e)
      this.setState({
        deployed: false,
        deploying: false,
        address: null!,
        transaction: transaction,
        error: 'There was an error in the transaction, please try again.',
      })
      return
    }

    if (!tx) {
      // No transaction found, the hash is wrong or ethers timed out.
      this.setState({
        deployed: false,
        deploying: false,
        address: null!,
        transaction: transaction,
        error: 'There was an error in the transaction, please try again.',
      })
      return
    }

    let newCollectionAddress: string = null!
    // Check if we have an events attribute
    if ((tx as any).events) {
      const event = (tx as any).events.find((e: any) => e.event == 'NewCollectionCreated')
      if (event) {
        // check if argument from events is a contract address
        if (isAddress(event.args[0])) {
          newCollectionAddress = event.args[0]
        }
      }
    }
    // IF nothing, check if we have logs.
    if (!newCollectionAddress && !!tx.logs[0]) {
      newCollectionAddress = tx.logs[0].address
    }

    // final check to make sure we indeed have an address
    if (!isAddress(newCollectionAddress)) {
      // No address found
      this.setState({
        deployed: false,
        deploying: false,
        address: null!,
        transaction: transaction,
        error: 'Could not obtain the contract address',
      })
      return
    }

    this.setState({ address: newCollectionAddress, transaction: transaction }, () => {
      this.saveNewAddress()
    })
  }

  async saveNewAddress() {
    const body = JSON.stringify({ address: this.state.address, id: this.state.id })
    let p
    try {
      p = await fetch(`${process.env.API}/collections/update/address`, {
        headers,
        method: 'put',
        body,
      })
    } catch {
      this.setState({ deploying: false, error: `Could not reach endpoint, please try again later.` })
      return
    }
    const r = await p.json()

    if (!r.success) {
      this.setState({ deploying: false, error: r.message || `Unable to submit new address ${this.state.address}, please report!` })
      return
    }
    // success do something send collection id to deploy stage
    this.setState({ deploying: false, deployed: true }, () => {
      this.props.nextStage && this.props.nextStage(this.state)
    })
  }

  render() {
    return (
      <div>
        <h3>Step 3: Save and Deploy on {SUPPORTED_CHAINS_BY_ID[this.collection.chainId!]}</h3>
        <div>
          <label>Name for the contract</label>
          <input type="text" name="name" disabled={this.state.deploying} maxLength={20} onInput={(e) => this.setName((e as any).target['value'])} value={this.state.name} />
          <small>Try something unique, this is the name that will be forever saved on the blockchain. It will also be used by Opensea to generate a collection URL (editable). </small>
        </div>
        <div style={{ paddingLeft: '120px', paddingBottom: '32px' }}>
          <label>
            <input checked={this.state.accepted} disabled={this.state.deploying} type="checkbox" onClick={(e) => this.setState({ accepted: (e as any).target['checked'] })} />I assert that I own or have rights to this collection
          </label>
          , and agree to the <a href="/terms">terms of service</a>
        </div>
        <button disabled={!this.state.accepted || this.state.uploading || this.state.deploying} onClick={() => this.uploadAndDeploy()}>
          {this.state.id ? `Deploy` : `Upload And Deploy`}
        </button>
        {this.state.uploading && <p> Saving new collection, please do not refresh the page... </p>}
        {this.state.error && <p>{this.state.error}</p>}
        {this.state.uploaded && <p>Halfway there!, Collection was created as #{this.state.id} and all that's left is the contract creation!</p>}
        {this.state.deploying && <p> Deploying, please do not leave or refresh the page... </p>}
        {this.state.uploaded && !!this.state.transaction && !!this.state.error && (
          <button
            onClick={() => {
              window.open(`/collection/fix/${this.state.id}`, '_blank')
            }}
          >
            {' '}
            Fix my collection
          </button>
        )}
        {
          // Special case for when we successfully save the collection, but tx to make contract failed.
          this.state.uploaded && !!this.state.error && !this.state.deploying && <button onClick={() => this.deploy()}>Try again...</button>
        }
        <br />
        <hr />
        <div style="margin-left:10px;background-color: #f1f1f1;">
          <p>
            <u>Log of chain interactions:</u>
          </p>
          <div>
            <label>Your contract address:</label>
            <input style={{ width: '50%' }} type="text" readOnly={true} onClick={this.copyToClipboard} value={this.state.address} />
          </div>

          <div>
            <label>The transaction:</label>
            <textarea
              rows={10}
              cols={90}
              value={JSON.stringify(this.state.transaction)}
              readOnly={true}
              ref={(c) => {
                this.textarea = c!
              }}
            />
          </div>

          <div>
            {this.state.deployed && <h2>Congratulations! Contract was successfully deployed.</h2>}
            {this.state.error && <h2>There was an error, could not deploy the contract.</h2>}
            {this.state.deployed &&
              (this.collection.chainId != 1 ? (
                <a href={`https://polygonscan.com/address/${this.state.address}`} target="_blank">
                  See on Polygon chain
                </a>
              ) : (
                <a href={`https://etherscan.io/address/${this.state.address}`} target="_blank">
                  See on Etherscan
                </a>
              ))}
          </div>
        </div>
        {this.collection.chainId == 137 && (
          <p>
            To deploy a smart contract on Polygon/Matic, you will need some Matic! <p>Here is a list of links you can use to learn more about obtaining MATIC.</p>
            <ul>
              <li>
                <a href="https://app.uniswap.org/#/swap" target="_blank">
                  Swap token on Ethereum Chain (using Airswap)
                </a>{' '}
              </li>
              <li>
                <a href="https://app.uniswap.org/#/swap" target="_blank">
                  Swap token on Ethereum Chain (using Uniswap)
                </a>{' '}
              </li>
              <li>
                <a href="https://metamask.io/swaps" target="_blank">
                  Swap token on Ethereum Chain (using Metamask)
                </a>{' '}
              </li>
            </ul>
          </p>
        )}

        {!!this.state.id && (
          <div>
            Useful debug link:
            <a href={`/collection/fix/${this.state.id}`}>Fix a collection with no address</a>
          </div>
        )}
      </div>
    )
  }
}

class StepFourCreationSuccess extends Component<{ collection: Collection }, { collection: Collection }> {
  textarea: HTMLTextAreaElement = undefined!

  constructor(props: any) {
    super()

    this.state = {
      collection: props.collection,
    }
  }

  get collection() {
    return this.state.collection
  }

  copyToClipboard = (e: any) => {
    const input: HTMLInputElement = e.target
    input.select()
    document.execCommand('copy')
    e.target.focus()
    app.showSnackbar('Copied to clipboard!', PanelType.Success)
  }

  render() {
    return (
      <div style={{ backgroundColor: '#dce3dc' }}>
        <h3>Your Collection was successfully created</h3>
        <p>
          Your Collection is available here:{' '}
          <a href={`/collections/${SUPPORTED_CHAINS_BY_ID[this.collection.chainId?.toString() ?? '0']}/${this.collection.address}?cb=` + Date.now()} target="_blank">
            {this.collection.name}
          </a>
        </p>
        <hr></hr>
        <p>Your contract was succesfully deployed: </p>
        {this.collection.chainId != 1 ? (
          <a href={`https://polygonscan.com/address/${this.collection.address}#internaltx`} target="_blank">
            See on Matic chain
          </a>
        ) : (
          <a href={`https://etherscan.io/address/${this.collection.address}`} target="_blank">
            See on Etherscan
          </a>
        )}
        <br />
        <p>
          Chain: {chainIds().find((c) => c.id === this.collection.chainId?.toString())?.name} -id: {this.collection.chainId?.toString()}
        </p>
        <p>
          Contract address:
          <input style={{ width: '50%' }} type="text" readOnly={true} onClick={this.copyToClipboard} value={this.collection.address} />
        </p>
        <p>Contract short name: {this.collection.name}</p>
      </div>
    )
  }
}

export function chainIds() {
  //mainnet, matic
  return [
    { id: '1', name: 'Ethereum' },
    { id: '137', name: 'Polygon' },
    ...(process.env.NODE_ENV == 'development'
      ? [
          {
            id: '80001',
            name: 'Mumbai',
          },
        ]
      : []),
  ]
}
