export function ethTrunc(wallet: string | null | undefined) {
  if (!wallet) {
    return ''
  }

  return wallet.slice(0, 5) + '..' + wallet.slice(-3)
}
