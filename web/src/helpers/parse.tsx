// Parse user token into defined type or return undefined or return defaultValue

const parse = {
  ethaddress: (token: any): string | undefined => {
    if (typeof token != 'string') {
      return
    }

    const s = token.toString()

    return s.match(/^0x[a-fA-F0-9]{40}$/) ? s : undefined
  },
  page: (token: any, defaultValue?: number): number | undefined => {
    let s

    if (typeof token != 'string') {
      s = parseInt(token, 10)
    } else if (typeof token == 'number') {
      s = token
    } else {
      return
    }

    return isNaN(s) ? defaultValue : s
  },
}

export default parse
