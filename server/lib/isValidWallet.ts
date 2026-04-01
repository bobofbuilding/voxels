export function validWallet(value: any) {
  return typeof value === 'string' && value.startsWith('0x') && value.length === 42
}
