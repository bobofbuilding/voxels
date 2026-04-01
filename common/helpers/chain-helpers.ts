export interface AddEthereumChainParameter {
  chainId: string // A 0x-prefixed hexadecimal string
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string // 2-6 characters long
    decimals: 18
  }
  rpcUrls: string[]
  blockExplorerUrls?: string[]
  iconUrls?: string[] // Currently ignored.
}

export const maticChain: AddEthereumChainParameter = {
  chainId: '0x89', // A 0x-prefixed hexadecimal string
  chainName: 'Matic Mainnet',
  nativeCurrency: {
    name: 'Matic',
    symbol: 'MATIC', // 2-6 characters long
    decimals: 18,
  },
  rpcUrls: ['https://polygon-rpc.com/'],
  blockExplorerUrls: ['https://polygonscan.com/'],
}

export const ethChain: AddEthereumChainParameter = {
  chainId: '0x1', // A 0x-prefixed hexadecimal string
  chainName: 'Ethereum Mainnet',
  nativeCurrency: {
    name: 'Mainnet',
    symbol: 'ETH', // 2-6 characters long
    decimals: 18,
  },
  rpcUrls: [`https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`],
  blockExplorerUrls: ['https://etherscan.io'],
}

export const supportedChains: AddEthereumChainParameter[] = [maticChain, ethChain]

export const Ethereum = parseInt(ethChain.chainId, 16)
export const Polygon = parseInt(maticChain.chainId, 16)

export const supportedChainsIds = [Polygon, Ethereum] as const
export type ChainID = typeof Ethereum | typeof Polygon
export const SUPPORTED_CHAINS: Record<string, number> = {
  eth: parseInt(ethChain.chainId, 16),
  polygon: parseInt(maticChain.chainId, 16),
  'off-chain': 0,
}
export type ChainIdentifier = 'eth' | 'polygon' | 'off-chain'

export const SUPPORTED_CHAINS_BY_ID: Record<string, ChainIdentifier> = {
  '1': 'eth',
  '137': 'polygon',
  '0': 'off-chain',
}
export const SUPPORTED_CHAINS_KEYS = Array.from(Object.keys(SUPPORTED_CHAINS))
export const getChainIdByName = (key: ChainIdentifier) => {
  switch (key) {
    case 'eth':
      return Ethereum
    case 'polygon':
      return Polygon
    case 'off-chain':
      return 0
    default:
      return Ethereum
  }
}
