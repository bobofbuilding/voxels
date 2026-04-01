import winston from 'winston'
import { ClientState } from './clientState'
import { ClientUUID } from './clientUUID'
import { SpaceId } from './spaceId'

export type ClientStateStore = {
  store(state: ClientState): void
  delete(id: ClientUUID): void
  get(id: ClientUUID): ClientState | null
  getByWallet(wallet: string): ClientState | null
  getIterator(): Iterable<ClientState>
  count(): number
  has(id: ClientUUID): boolean
  keys(): Iterable<ClientUUID>
  dispose(): void
}

export type GlobalClientStateStore = {
  getStore(spaceId: SpaceId | 'world'): ClientStateStore
  dispose(): void
  disposeStore(spaceId: SpaceId | 'world'): void
  getWorldCount(): number
  getSpaceCount(): number
}

export class InMemoryGlobalClientStateStore implements GlobalClientStateStore {
  private readonly _stores: Map<SpaceId | 'world', ClientStateStore>

  constructor(private logger: winston.Logger) {
    this._stores = new Map<SpaceId | 'world', ClientStateStore>()
  }

  getStore(spaceId: SpaceId | 'world'): ClientStateStore {
    let store = this._stores.get(spaceId)
    if (!store) {
      this.logger.debug('Creating new client state store for', spaceId)
      store = new InMemoryClientStateStore(spaceId, this.logger)
      this._stores.set(spaceId, store)
    }
    return store
  }

  dispose(): void {
    for (const store of this._stores.values()) {
      store.dispose()
    }
  }

  disposeStore(spaceId: SpaceId | 'world'): void {
    const store = this._stores.get(spaceId)
    if (store) {
      store.dispose()
      this._stores.delete(spaceId)
    }
  }

  getWorldCount(): number {
    return this._stores.get('world')?.count() ?? 0
  }

  getSpaceCount(): number {
    let count = 0
    for (const [id, store] of this._stores.entries()) {
      if (id === 'world') continue
      count += store.count()
    }
    return count
  }
}

export class InMemoryClientStateStore implements ClientStateStore {
  private readonly _state: Map<ClientUUID, ClientState>

  constructor(
    private readonly channel: SpaceId | 'world',
    private logger: winston.Logger,
  ) {
    this._state = new Map<ClientUUID, ClientState>()
  }

  getByWallet(wallet: string): ClientState | null {
    for (const state of this._state.values()) {
      if (state.identity?.wallet === wallet) {
        return state
      }
    }
    return null
  }

  has(id: ClientUUID): boolean {
    return this._state.has(id)
  }

  keys(): Iterable<ClientUUID> {
    return this._state.keys()
  }

  count(): number {
    return this._state.size
  }

  get(id: ClientUUID): ClientState | null {
    return this._state.get(id) ?? null
  }

  getIterator(): Iterable<ClientState> {
    return this._state.values()
  }

  store(state: ClientState) {
    this._state.set(state.clientUUID, state)
  }

  delete(id: ClientUUID): void {
    this._state.delete(id)
  }

  dispose(): void {
    this._state.clear()
  }
}
