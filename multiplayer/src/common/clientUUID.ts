export type ClientUUID = string & { __brand: 'clientUUID' }

export namespace ClientUUID {
  export const create = (uuid: string): ClientUUID => uuid as ClientUUID

  export const tryParse = (s: string): ClientUUID | null => {
    if (!s || !isClientUuid(s)) return null
    return s as ClientUUID
  }

  const isClientUuid = (str: string): boolean =>
    str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) !== null
}
