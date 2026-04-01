import { ethers } from 'ethers'
import { ethAlchemy, parcelInterface, ADDRESSES, landworksInterface } from '../lib/utils'
import Parcel from '../parcel'
import ParcelUserRight from '../parcel-user-right'
import { named } from '../lib/logger'

const logger = named('EthereumListener')

const handleParcelTransferEvent = async (log: Event, event: any) => {
  /**
 *
    const l = {
      blockNumber: 23744192,
      blockHash: '0x15c93179285f49758fa4ad914c91ca7e7253ff128ee254ea08b8229d3df756eb',
      transactionIndex: 62,
      removed: false,
      address: '0x79986af15539de2db9a5086382daeda917a9cf0c',
      data: '0x0000000000000000000000000000000000000000000000000000000000001a33',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x00000000000000000000000026103a34e06157a90a6c2c067c5a183fb1f1b4bc',
        '0x000000000000000000000000dbb68b0a7d27121b2090526ec96b2ce2e4b304be'
      ],
      transactionHash: '0x58a9e9f706386c7e1d12f5115d36d306f08da8ecdfe93731f18b6d96ed09f507',
      logIndex: 431
    }
 */

  let l = log as any
  let parsedLog: any
  try {
    parsedLog = parcelInterface.parseLog(l)
  } catch (e) {
    logger.error(`Error parsing log ${l.transactionHash} ${l.logIndex}`)
    return
  }

  // event Transfer(address indexed _from, address indexed _to, uint256 _tokenId);
  const tokenId = Number(parsedLog.args['_tokenId'])
  const to = parsedLog.args['_to']
  const from = parsedLog.args['_from']

  const parcel = await Parcel.load(tokenId)
  if (!parcel) {
    // Handle mint event potentially.
    return
  }
  if (!ethers.isAddress(to)) {
    return
  }
  parcel.owner = to
  if (!parcel.minted) {
    // This parcel has recently been minted! Remember to make it visible the next time it's saved.
    // (This, and similar logic in AbstractParcel.queryContract(), is now the *only* way in which the minted and
    // visible properties of a parcel interact.)
    parcel._justGotMinted = true
  }
  parcel.minted = true
  parcel.save()
}

const handleLandworksConsumerChangedEvent = async (log: Event, event: any) => {
  let l = log as any
  let parsedLog: any
  try {
    parsedLog = landworksInterface.parseLog(l)
  } catch (e) {
    logger.error(`Error parsing log ${l.transactionHash} ${l.logIndex}`)
    return
  }

  // event Transfer(address owner, address indexed consumer, uint256 tokenId);
  const tokenId = Number(parsedLog.args['tokenId'])
  const consumer = parsedLog.args['consumer']

  ParcelUserRight.evictRenter(tokenId)
  if (consumer !== ethers.ZeroAddress) {
    // new consumer is not the address Zero, it's a new renter
    ParcelUserRight.createRenter(tokenId, consumer)
    ParcelUserRight.deleteAllButRenter(tokenId)
  }
}

// This filter could also be generated with the Contract or
// Interface API. If address is not specified, any address
// matches and if topics is not specified, any log matches
const parcelTransferEventFilter = () => ({
  address: ADDRESSES.PARCEL_ADDRESS,
  topics: [ethers.id('Transfer(address,address,uint256)')], //(topic[0] = A) OR (topic[0] = B
})
const LandworksConsumerChangedEventFilter = () => ({
  address: ADDRESSES.LANDWORKS,
  topics: [ethers.id('ConsumerChanged(address,address,uint256)')], //(topic[0] = A) OR (topic[0] = B
})

export const EthereumListener = () => {
  // todo fixme
  // ;(ethAlchemy as any).ws.on(parcelTransferEventFilter(), handleParcelTransferEvent)
  // ;(ethAlchemy as any).ws.on(LandworksConsumerChangedEventFilter(), handleLandworksConsumerChangedEvent)
  logger.info(`todo: not listening for parcel transfer events`)
}
