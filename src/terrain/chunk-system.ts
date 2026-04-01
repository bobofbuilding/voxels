// ABOUTME: Simple chunk system for managing tile lifecycle in a grid-based world
// ABOUTME: Supports observer pattern for external systems to react to load/unload events

export interface ChunkPosition {
  gridX: number
  gridZ: number
}

export interface WorldPosition {
  x: number
  z: number
}

export interface Chunk {
  gridX: number
  gridZ: number
  worldX: number
  worldZ: number
}

export interface ChunkObserver {
  onChunkLoaded(chunk: Chunk): void
  onChunkUnloaded(chunk: Chunk): void
}

export class ChunkSystem {
  private chunkSize: number
  private loadedChunks: Map<string, Chunk> = new Map()
  private observers: ChunkObserver[] = []
  private lastCameraPosition: WorldPosition | null = null
  private lastLoadRange: number | null = null

  constructor(chunkSize: number) {
    this.chunkSize = chunkSize
  }

  /**
   * Update the chunk size at runtime, triggering a complete reload of chunks
   * This is useful when graphics settings change and view distance needs adjustment
   */
  updateChunkSize(newChunkSize: number): void {
    if (newChunkSize === this.chunkSize) {
      return
    }

    this.chunkSize = newChunkSize

    if (this.lastCameraPosition && this.lastLoadRange !== null) {
      this.reloadAllChunks()
    }
  }

  /**
   * Update chunks around the given position with specified load range
   */
  updateChunksAroundPosition(position: WorldPosition, loadRange: number): void {
    // Store the camera position and load range for potential chunk size updates
    this.lastCameraPosition = position
    this.lastLoadRange = loadRange
    const centerGrid = this.worldToGrid(position)
    const neededChunks = new Set<string>()

    // Generate chunks in range around center
    for (let dx = -loadRange; dx <= loadRange; dx++) {
      for (let dz = -loadRange; dz <= loadRange; dz++) {
        const gridX = centerGrid.gridX + dx
        const gridZ = centerGrid.gridZ + dz
        const key = `${gridX}_${gridZ}`

        neededChunks.add(key)

        // Load chunk if not already loaded
        if (!this.loadedChunks.has(key)) {
          const chunk = this.createChunk(gridX, gridZ)
          this.loadedChunks.set(key, chunk)
          this.notifyChunkLoaded(chunk)
        }
      }
    }

    // Unload chunks that are no longer needed
    const toRemove: string[] = []
    for (const [key, chunk] of this.loadedChunks) {
      if (!neededChunks.has(key)) {
        toRemove.push(key)
      }
    }

    for (const key of toRemove) {
      const chunk = this.loadedChunks.get(key)!
      this.loadedChunks.delete(key)
      this.notifyChunkUnloaded(chunk)
    }
  }

  /**
   * Convert world position to grid coordinates
   */
  worldToGrid(worldPos: WorldPosition): ChunkPosition {
    return {
      gridX: Math.floor(worldPos.x / this.chunkSize),
      gridZ: Math.floor(worldPos.z / this.chunkSize),
    }
  }

  /**
   * Convert grid coordinates to world position (center of chunk)
   */
  gridToWorld(gridPos: ChunkPosition): WorldPosition {
    return {
      x: gridPos.gridX * this.chunkSize + this.chunkSize / 2,
      z: gridPos.gridZ * this.chunkSize + this.chunkSize / 2,
    }
  }

  /**
   * Get all currently loaded chunks
   */
  getLoadedChunks(): Chunk[] {
    return Array.from(this.loadedChunks.values())
  }

  /**
   * Add an observer to be notified of chunk load/unload events
   */
  addObserver(observer: ChunkObserver): void {
    this.observers.push(observer)
  }

  /**
   * Remove an observer
   */
  removeObserver(observer: ChunkObserver): void {
    const index = this.observers.indexOf(observer)
    if (index >= 0) {
      this.observers.splice(index, 1)
    }
  }

  /**
   * Clear all observers
   */
  clearObservers(): void {
    this.observers = []
  }

  /**
   * Create a new chunk at the given grid position
   */
  private createChunk(gridX: number, gridZ: number): Chunk {
    // worldX/worldZ should be the minimum corner, not center
    return {
      gridX,
      gridZ,
      worldX: gridX * this.chunkSize,
      worldZ: gridZ * this.chunkSize,
    }
  }

  /**
   * Notify observers that a chunk was loaded
   */
  private notifyChunkLoaded(chunk: Chunk): void {
    for (const observer of this.observers) {
      observer.onChunkLoaded(chunk)
    }
  }

  /**
   * Notify observers that a chunk was unloaded
   */
  private notifyChunkUnloaded(chunk: Chunk): void {
    for (const observer of this.observers) {
      observer.onChunkUnloaded(chunk)
    }
  }

  /**
   * Unload all chunks and reload them around the last camera position
   */
  private reloadAllChunks(): void {
    if (!this.lastCameraPosition || this.lastLoadRange === null) {
      return
    }

    const chunksToUnload = Array.from(this.loadedChunks.values())
    this.loadedChunks.clear()

    for (const chunk of chunksToUnload) {
      this.notifyChunkUnloaded(chunk)
    }

    this.updateChunksAroundPosition(this.lastCameraPosition, this.lastLoadRange)
  }
}
