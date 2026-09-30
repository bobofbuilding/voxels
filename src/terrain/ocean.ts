import type { Chunk, ChunkObserver } from './chunk-system'
import type Islands from './islands'
import { createNeonGridMaterial } from '../materials/neon-grid'
import * as polygons from 'martinez-polygon-clipping'
import earcut, { flatten } from 'earcut'

type Ring = [number, number][]
type Region = { ring: Ring; minX: number; maxX: number; minZ: number; maxZ: number }
type Polygon = Ring[]
type MultiPolygon = Polygon[]
const GRID_SURFACE_HEIGHT = 0.74

/** Solid grid over former ocean/lakes. Keep island interiors open for basements. */
export class Ocean implements ChunkObserver {
  private readonly mesh: BABYLON.Mesh
  private readonly material: BABYLON.GridMaterial
  private instances = new Map<string, BABYLON.InstancedMesh>()
  private customMeshes = new Map<string, BABYLON.Mesh[]>()
  private land: Region[] | undefined
  private lakes: Region[] = []
  private pending = new Map<string, Chunk>()
  private frame: number | undefined
  private disposed = false

  constructor(
    private size: number,
    private scene: BABYLON.Scene,
  ) {
    this.mesh = BABYLON.MeshBuilder.CreateGround('grid/template', { width: size, height: size }, scene)
    this.mesh.setEnabled(false)
    this.material = createNeonGridMaterial('terrain/neon-grid', scene)
    this.mesh.material = this.material
  }

  createInstance(x: number, z: number): BABYLON.InstancedMesh {
    const mesh = this.mesh.createInstance(`grid/${x}/${z}`)
    mesh.position.set(this.size * (x + 0.5), GRID_SURFACE_HEIGHT, this.size * (z + 0.5))
    mesh.checkCollisions = true
    mesh.metadata = 'teleportable'
    return mesh
  }

  getInstances = () => this.mesh.instances
  getCustomMeshes = () => this.customMeshes

  setIslands(islands: Islands): void {
    const region = (coordinates: number[][], nudge = 0): Region[] => {
      const ring: Ring = coordinates.map(([x, z]) => [x * 100 + nudge, z * 100 + nudge])
      if (ring.length < 3 || ring.some((point) => point.some((value) => !Number.isFinite(value)))) return []
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push([...ring[0]])
      const xs = ring.map((p) => p[0]),
        zs = ring.map((p) => p[1])
      return [{ ring, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }]
    }
    this.land = []
    this.lakes = []
    for (const island of islands.getIslandData()) {
      const rings = island.id >= 40 ? island.geometry.coordinates : island.geometry.coordinates.slice(0, 1)
      this.land.push(...rings.flatMap((coordinates) => region(coordinates)))
      this.lakes.push(...(island.lakes_geometry_json?.coordinates || []).flatMap((lake) => region(lake[0], 0.25)))
    }
    this.processQueue()
  }

  onChunkLoaded(chunk: Chunk): void {
    const key = `${chunk.gridX}_${chunk.gridZ}`
    if (this.instances.has(key) || this.customMeshes.has(key)) return
    this.pending.set(key, chunk)
    this.processQueue()
  }

  onChunkUnloaded(chunk: Chunk): void {
    const key = `${chunk.gridX}_${chunk.gridZ}`
    this.pending.delete(key)
    this.instances.get(key)?.dispose()
    this.instances.delete(key)
    this.customMeshes.get(key)?.forEach((mesh) => mesh.dispose())
    this.customMeshes.delete(key)
  }

  dispose(): void {
    this.disposed = true
    if (this.frame !== undefined) cancelAnimationFrame(this.frame)
    this.pending.clear()
    this.instances.clear()
    this.customMeshes.forEach((meshes) => meshes.forEach((mesh) => mesh.dispose()))
    this.customMeshes.clear()
    this.mesh.dispose() // also disposes its instances
    this.material.dispose()
  }

  private processQueue(): void {
    if (!this.land || this.disposed || this.frame !== undefined) return
    const start = performance.now()
    for (const [key, chunk] of this.pending) {
      this.pending.delete(key)
      try {
        this.createTile(key, chunk)
      } catch (error) {
        console.error(`Could not build grid tile ${key}`, error)
      }
      if (performance.now() - start >= 8) break
    }
    if (this.pending.size) {
      this.frame = requestAnimationFrame(() => {
        this.frame = undefined
        this.processQueue()
      })
    }
  }

  private createTile(key: string, chunk: Chunk): void {
    const { worldX: x, worldZ: z } = chunk
    const tile: MultiPolygon = [
      [
        [
          [x, z],
          [x + this.size, z],
          [x + this.size, z + this.size],
          [x, z + this.size],
          [x, z],
        ],
      ],
    ]
    let ground = tile
    let clipped = false
    const overlaps = (region: Region) => region.maxX >= x && region.minX <= x + this.size && region.maxZ >= z && region.minZ <= z + this.size
    for (const region of this.land!) {
      if (!overlaps(region)) continue
      clipped = true
      if (ground.length) ground = (polygons.diff(ground, [[region.ring]]) || []) as MultiPolygon
    }
    for (const region of this.lakes) {
      if (!overlaps(region)) continue
      const lakeTile = (polygons.intersection(tile, [[region.ring]]) || []) as MultiPolygon
      if (lakeTile.length) ground = ground.length ? (polygons.union(ground, lakeTile) as MultiPolygon) : lakeTile
    }
    if (!clipped) {
      this.instances.set(key, this.createInstance(chunk.gridX, chunk.gridZ))
      return
    }
    const positions: number[] = []
    const indices: number[] = []
    // Triangulate outer ring AND holes together. Flattening holes as independent
    // filled polygons would put an invisible solid lid over island basements.
    for (const polygon of ground) {
      const flat = flatten(polygon)
      const offset = positions.length / 3
      for (let i = 0; i < flat.vertices.length; i += 2) positions.push(flat.vertices[i] - x, 0, flat.vertices[i + 1] - z)
      indices.push(...earcut(flat.vertices, flat.holes, 2).map((i) => i + offset))
    }
    if (!indices.length) {
      this.customMeshes.set(key, [])
      return
    }
    const mesh = new BABYLON.Mesh(`grid/clipped/${key}`, this.scene)
    const data = new BABYLON.VertexData()
    data.positions = positions
    data.indices = indices
    data.normals = Array.from({ length: positions.length }, (_, i) => (i % 3 === 1 ? 1 : 0))
    data.applyToMesh(mesh)
    mesh.material = this.material
    mesh.position.set(x, GRID_SURFACE_HEIGHT, z)
    mesh.checkCollisions = true
    mesh.metadata = 'teleportable'
    this.customMeshes.set(key, [mesh])
  }
}
