import Parcel, { IParcelRef } from '../parcel'
import GridShard from './GridShard'
import { StatePersistQueueEntry } from './GridSocket'
import { GridClusterMessageBroker } from './GridClusterMessageBroker'
import { PatchSet } from './PatchSet'
import { GridShardMessage } from './GridShardMessage'
import _authParcel from '../auth-parcel'
import { ParcelAuthResult } from '../../common/messages/parcel'
import log from '../lib/logger'
import { VoxelsUser } from '../user'

export const createWorldGridShardParameters = (
  gridCluster: GridClusterMessageBroker,
  patchSetByClientId: Map<string, PatchSet>,
  parcelStateCache: Map<number, Record<string, unknown>>,
  statePersistQueue: StatePersistQueueEntry[],
): ConstructorParameters<typeof GridShard> => {
  const tryLoadParcelRef = (parcelId: number): Promise<IParcelRef | null> => Parcel.loadRef(parcelId)
  const tryLoadParcel = (parcelId: number): Promise<Parcel | null> => Parcel.load(parcelId)

  const tryLoadParcelFeatures = async (parcelId: number): Promise<Record<string, unknown> | null> => {
    const parcel = await Parcel.load(parcelId)
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

  const tryLoadParcelState = (parcelId: number): Promise<Record<string, unknown> | null> => Parcel.getState(parcelId)

  const publishShardMessage = async (message: GridShardMessage): Promise<void> => {
    if (message.type === 'patchCreate') {
      const patchSet = patchSetByClientId.get(message.payload.sender)
      if (patchSet) {
        patchSet.add(message.payload.parcelId, message.payload.patch)
      } else {
        // Likely cause: Client sent patch then closed connection before async patch processing could complete (see sc-4838)
        log.error(`publishShardMessage() for world grid: no PatchSet found for client ID '${message.payload.sender}'!`)
      }
    } else if (message.type === 'patchStateCreate') {
      // TODO cleanup any features that are no longer present
      const state = (await Parcel.getState(message.payload.parcelId)) || {}
      Object.assign(state, message.payload.patch)
      parcelStateCache.set(message.payload.parcelId, state)

      // queue for persistence to DB
      if (
        !statePersistQueue.some((entry) => {
          entry.type === 'parcel' && entry.parcelId === message.payload.parcelId
        })
      ) {
        statePersistQueue.push({ type: 'parcel', parcelId: message.payload.parcelId })
      }
    }

    gridCluster.publish(message)
  }

  const startLightmapBake = async (parcelId: number): Promise<void> => {
    // noop
  }

  const cancelLightmapBake = async (parcelId: number): Promise<void> => {
    // noop
  }

  // Must be called with a parcel loaded with this GridShard's tryLoadParcelRef() or tryLoadParcel().
  const authParcel = async (parcel: IParcelRef, user: VoxelsUser | null): Promise<ParcelAuthResult> => {
    return _authParcel(parcel, user)
  }

  return [tryLoadParcel, tryLoadParcelRef, tryLoadParcelFeatures, tryLoadParcelState, publishShardMessage, startLightmapBake, cancelLightmapBake, authParcel]
}
