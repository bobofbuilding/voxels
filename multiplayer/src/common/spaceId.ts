export type SpaceId = string & { __brand: 'SpaceId' }

export namespace SpaceId {
  export const tryParse = (s: string): SpaceId | null => {
    if (!isSpaceId(s)) return null
    return s as SpaceId
  }
}

const isSpaceId = (str: string): boolean =>
  str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) !== null
