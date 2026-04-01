import { SpaceId } from './spaceId'

export type ShardId = ShardId.World | ShardId.Space //| ShardId.PremiumSpace

export namespace ShardId {
  export type World = {
    type: 'world'
  }

  export type Space = {
    type: 'space'
    spaceId: SpaceId
  }

  // export type PremiumSpace = {
  //   type: 'premium-space'
  //   spaceId: SpaceId
  // }

  export type AllShards = {
    type: 'all'
  }
}
