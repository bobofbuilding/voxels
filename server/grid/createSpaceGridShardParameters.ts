import { GridClusterMessage, GridClusterMessageBroker } from './GridClusterMessageBroker'
import GridShard from './GridShard'
import { StatePersistQueueEntry } from './GridSocket'
import { AbstractParcel, IParcelRef } from '../parcel'
import Space, { SINGLE_VALID_SPACE_PARCEL_ID } from '../space'
import { GridShardMessage } from './GridShardMessage'
import { PatchSet } from './PatchSet'
import { authSpace } from '../auth-parcel'
import { ParcelAuthResult } from '../../common/messages/parcel'
import log from '../lib/logger'
import { VoxelsUser } from '../user'

export const createSpaceGridShardParameters = (
  gridCluster: GridClusterMessageBroker,
  patchSetByClientId: Map<string, PatchSet>,
  spaceStateCache: Map<string, Record<string, unknown>>,
  statePersistQueue: StatePersistQueueEntry[],
  spaceId: string,
): ConstructorParameters<typeof GridShard> => {
  const tryLoadParcelRef = async (parcelId: number): Promise<IParcelRef | null> => {
    if (parcelId !== SINGLE_VALID_SPACE_PARCEL_ID) return null
    return await Space.loadRef(spaceId)
  }

  const tryLoadParcel = async (parcelId: number): Promise<AbstractParcel | null> => {
    if (parcelId !== SINGLE_VALID_SPACE_PARCEL_ID) return null

    return await Space.load(spaceId)
  }

  const tryLoadParcelFeatures = async (parcelId: number): Promise<Record<string, unknown> | null> => {
    if (parcelId !== SINGLE_VALID_SPACE_PARCEL_ID) return null

    const parcel = await Space.load(spaceId)
    if (!parcel) {
      return null
    }

    const result: Record<string, unknown> = {}

    if (parcel.content) {
      for (const feature of parcel.content.features) {
        result[feature.uuid] = feature
      }
    }

    return result
  }

  const tryLoadParcelState = (): Promise<Record<string, unknown> | null> => Space.getState(spaceId)

  const publishShardMessage = async (message: GridShardMessage): Promise<void> => {
    if (message.payload.parcelId !== SINGLE_VALID_SPACE_PARCEL_ID) return

    if (message.type === 'patchCreate') {
      const patchSet = patchSetByClientId.get(message.payload.sender)
      if (patchSet) {
        patchSet.add(message.payload.parcelId, message.payload.patch)
      } else {
        // Likely cause: Client sent patch then closed connection before async patch processing could complete (see sc-4838)
        log.error(`publishShardMessage() for space ${spaceId} grid: no PatchSet found for client ID '${message.payload.sender}'!`)
      }
    } else if (message.type === 'patchStateCreate') {
      // TODO cleanup any features that are no longer present
      const state = (await Space.getState(spaceId)) || {}
      Object.assign(state, message.payload.patch)
      spaceStateCache.set(spaceId, state)

      // queue for persistence to DB
      if (
        !statePersistQueue.some((entry) => {
          entry.type === 'space' && entry.spaceId === spaceId
        })
      ) {
        statePersistQueue.push({ type: 'space', spaceId })
      }
    }

    gridCluster.publish(GridClusterMessage.withSpaceId(message, spaceId))
  }

  const startLightmapBake = async (): Promise<void> => {
    // noop
  }

  const cancelLightmapBake = async (): Promise<void> => {
    // noop
  }

  // Must be called with a parcel loaded with this GridShard's tryLoadParcelRef() or tryLoadParcel().
  const authParcel = async (parcel: IParcelRef, user: VoxelsUser | null): Promise<ParcelAuthResult> => {
    return authSpace(parcel, user)
  }

  return [tryLoadParcel, tryLoadParcelRef, tryLoadParcelFeatures, tryLoadParcelState, publishShardMessage, startLightmapBake, cancelLightmapBake, authParcel]
}
