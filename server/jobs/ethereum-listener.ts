import { ethers } from 'ethers'
import { ethAlchemy, parcelInterface, ADDRESSES } from '../lib/utils'
import Parcel from '../parcel'
import { named } from '../lib/logger'

const logger = named('EthereumListener')

const handleParcelTransferEvent = async (log: Event, event: any) => {
  let l = log as any
  let parsedLog: any
  try {
    parsedLog = parcelInterface.parseLog(l)
  } catch (e) {
    logger.error(`Error parsing log ${l.transactionHash} ${l.logIndex}`)
    return
  }

  const tokenId = Number(parsedLog.args['_tokenId'])
  const to = parsedLog.args['_to']

  const parcel = await Parcel.load(tokenId)
  if (!parcel) return
  if (!ethers.isAddress(to)) return
  parcel.owner = to
  if (!parcel.minted) parcel._justGotMinted = true
  parcel.minted = true
  parcel.save()
}

const parcelTransferEventFilter = () => ({
  address: ADDRESSES.PARCEL_ADDRESS,
  topics: [ethers.id('Transfer(address,address,uint256)')],
})

export const EthereumListener = () => {
  // todo fixme
  // ;(ethAlchemy as any).ws.on(parcelTransferEventFilter(), handleParcelTransferEvent)
  logger.info(`todo: not listening for parcel transfer events`)
}
