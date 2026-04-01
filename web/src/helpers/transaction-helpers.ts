export const getTransactionLink = (chainID?: number, hash?: string | null) => {
  if (!chainID || !hash) {
    let error: string
    if (!chainID && !hash) {
      error = 'cant get transaction link without chainID and hash'
    } else if (!chainID) {
      error = 'cant get transaction link without chainID'
    } else {
      error = 'cant get transaction link without hash'
    }
    console.error(new Error(error))
    return ''
  }
  return (chainID == 1 ? `https://etherscan.io/tx/` : `https://polygonscan.com/tx/`) + hash
}
