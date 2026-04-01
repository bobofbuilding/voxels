import { ethers } from 'ethers'
import log from './logger'
import { getContract } from './utils'
import { SUPPORTED_CHAINS } from '../../common/helpers/chain-helpers'

async function getEthUsd(): Promise<number> {
  const contract = await getContract('chainlink-eth-usd', SUPPORTED_CHAINS['eth'])
  try {
    const [, answer] = await contract.latestRoundData()
    return Number(answer) / 1e8
  } catch (error) {
    log.error('[prices] Failed to fetch ETH/USD price from Chainlink:', error)
    throw new Error('Unable to fetch ETH/USD price')
  }
}
export async function convertEthToUsd(ethAmount: number): Promise<number> {
  const ethUsd = await getEthUsd()
  return ethAmount * ethUsd
}
