import Grid from '../grid'
import { defaultColors, getBlockId } from '../../common/content/blocks'
import type Parcel from '../parcel'
import Connector from '../connector'
import Controls from '../controls/controls'
import { User } from '../user'
import { AudioEngine } from '../audio/audio-engine'
import type { Tool } from '../user-interface'
import { signal } from '@preact/signals'
import type { Scene } from '../scene'
import VertexShader from '../shaders/ao-mesh.vsh'
import FragmentShader from '../shaders/ao-mesh.fsh'
import { createGlassMaterial } from '../materials/glass'

/*
 * Fixme - this needs some refactoring around selection mode and selection
 */

export enum SelectionMode {
  Paint,
  Remove,
  Add,
}

interface VoxelPickingInfo {
  position: BABYLON.Vector3
  parcel: Parcel
}

interface Selection {
  start?: BABYLON.Vector3
  end?: BABYLON.Vector3
  parcel?: Parcel
  mode: SelectionMode
  fixedMode?: boolean
  model?: any
  textureIndex?: number
  tint?: number
  count?: number
}

export type SelectionModeOptions = {
  start?: BABYLON.Vector3
  end?: BABYLON.Vector3
  parcel?: Parcel
  fixedMode?: boolean
  model?: any
  texture?: number
  tint?: number
  count?: number
}

export default class Selector implements Tool {
  scene: BABYLON.Scene
  parent: BABYLON.TransformNode
  box: BABYLON.Mesh
  clones: Array<BABYLON.Mesh> = []
  grid: Grid
  selection: Selection
  enabled = signal(false)
  connector: Connector
  controls: Controls
  user: User
  mousedown = false
  pointerPredicateCache: {
    pointerUp: (mesh: BABYLON.AbstractMesh) => boolean
    pointerDown: (mesh: BABYLON.AbstractMesh) => boolean
  } | null = null

  clickAction: any
  atlasTexture: BABYLON.Texture
  glassTexture: BABYLON.Texture
  voxelMaterial: BABYLON.ShaderMaterial
  glassMaterial: BABYLON.Material

  lastOnMovePickResult: BABYLON.PickingInfo | undefined = undefined
  private lastParcel: Parcel | undefined = undefined

  onBuildToolActivate: BABYLON.Observable<void> = new BABYLON.Observable()
  onCurrentTextureTintUpdate: BABYLON.Observable<{ texture: number; tint: number }> = new BABYLON.Observable<{ texture: number; tint: number }>()

  constructor(scene: BABYLON.Scene, parent: BABYLON.TransformNode, grid: Grid, controls: Controls, connector: Connector) {
    this.scene = scene
    this.grid = grid
    this.controls = controls
    this.connector = connector
    this.user = controls.user
    this.parent = parent

    // Selection box
    this.box = BABYLON.MeshBuilder.CreateBox('tools/voxel/selector', { size: 0.51 }, scene)
    this.box.parent = this.parent
    this.box.isPickable = false

    // Add custom vertex attributes for voxel shader compatibility
    // CreateBox produces 24 vertices (4 per face × 6 faces)
    const vertexCount = this.box.getTotalVertices()
    const blockData = new Float32Array(vertexCount).fill(0)
    const aoData = new Float32Array(vertexCount).fill(255)
    this.box.setVerticesData('block', blockData, true, 1)
    this.box.setVerticesData('ambientOcclusion', aoData, false, 1)

    // Load the atlas texture
    this.atlasTexture = new BABYLON.Texture('/textures/atlas-ao.png', scene)
    // Load glass texture (kept for potential future use)
    this.glassTexture = new BABYLON.Texture('/images/glass.png', scene)

    // Create ShaderMaterial using the same voxel shader for consistent UV handling
    const material = new BABYLON.ShaderMaterial(
      'tools/voxel/selector',
      scene,
      { vertexSource: VertexShader, fragmentSource: FragmentShader },
      {
        attributes: ['position', 'normal', 'block', 'ambientOcclusion'],
        uniforms: ['worldViewProjection', 'tileSize', 'tileCount', 'brightness', 'ambient', 'lightDirection', 'fogDensity', 'fogColor', 'palette', 'alpha'],
        samplers: ['tileMap'],
        defines: ['#define IMAGEPROCESSINGPOSTPROCESS'],
      },
    )

    material.setTexture('tileMap', this.atlasTexture)
    material.setFloat('tileSize', 128)
    material.setFloat('tileCount', 4.0)
    material.setFloat('alpha', 0.85)
    material.alphaMode = BABYLON.Engine.ALPHA_COMBINE
    material.needAlphaBlending = () => true
    material.setColor3Array(
      'palette',
      defaultColors.map((c) => BABYLON.Color3.FromHexString(c)),
    )
    ;(scene as Scene).environment?.setShaderParameters(material, 1.5)

    // Block dirty mechanism to prevent unnecessary shader recompilation
    material.blockDirtyMechanism = true

    this.voxelMaterial = material
    this.glassMaterial = createGlassMaterial(scene as Scene, { name: 'ghost-block' })
    this.box.material = material

    // No default block
    this.selection = {
      mode: SelectionMode.Add,
      textureIndex: 0,
      tint: 0,
    }

    // Bind to the object so that this can be passed directly to Bablyon observable
    this.onPointerObservable = this.onPointerObservable.bind(this)
  }

  get audio(): AudioEngine | undefined {
    return window._audio
  }

  get texture() {
    return this.selection?.textureIndex || 0
  }

  set texture(value: number) {
    this.selection.textureIndex = value
    this.setTextureOffset(value)
    this.onCurrentTextureTintUpdate.notifyObservers({ texture: this.texture, tint: this.tint })
  }

  private setTextureOffset(value: number) {
    // Glass (texture index 1) uses a special transparent material for accurate preview
    const isGlass = value === 1
    if (isGlass) {
      this.box.material = this.glassMaterial
      return
    }

    // Switch back to voxel shader material for non-glass textures
    this.box.material = this.voxelMaterial

    // Update the block vertex attribute to select the texture tile
    // Toolbelt slot 0 maps to atlas position 1 (position 0 is empty/special)
    // Block value encodes: textureIndex + (tintIndex * 32)
    const textureIndex = value + 1
    const blockValue = textureIndex + this.tint * 32

    const vertexCount = this.box.getTotalVertices()
    const blockData = new Float32Array(vertexCount).fill(blockValue)
    this.box.updateVerticesData('block', blockData)
  }

  get tint() {
    return this.selection?.tint || 0
  }

  set tint(value: number) {
    this.selection.tint = value
    this.updatePaletteColor()
    this.onCurrentTextureTintUpdate.notifyObservers({ texture: this.texture, tint: this.tint })
  }

  get blockId() {
    return getBlockId(this.texture, this.tint)
  }

  private async updateMaterialForParcel(parcel: Parcel): Promise<void> {
    const material = this.box.material as BABYLON.ShaderMaterial
    if (!material) return

    // Use parcel's tileset texture if available, otherwise default atlas
    const texture = parcel.tilesetTexture || Grid.mesher.defaultTileset

    // Update the shader's tileMap texture
    material.setTexture('tileMap', texture)
    this.atlasTexture = texture

    // Update palette and block attribute for new parcel
    this.updatePaletteColor()
  }

  private updatePaletteColor(): void {
    const material = this.box.material as BABYLON.ShaderMaterial
    if (!material) return

    // Update palette uniform on the shader
    const parcel = this.selection.parcel
    const palette = parcel?.paletteColors || defaultColors.map((c) => BABYLON.Color3.FromHexString(c))
    material.setColor3Array('palette', palette)

    // Update block attribute to reflect current texture + tint
    this.setTextureOffset(this.texture)
  }

  get ui() {
    return window.ui
  }

  setMode(mode: SelectionMode, selection?: SelectionModeOptions) {
    this.selection.mode = mode
    // Object.assign doesn't call setters.
    if (selection) {
      Object.entries(selection).forEach(([key, value]) => {
        if (key in this.selection) {
          ;(this as any)[key as any] = value // uses setters if they exist
        } else {
          Object.assign(this.selection, { [key]: value })
        }
      })
    }
    this.selection.fixedMode = selection?.fixedMode || false

    this.audio?.playSound('build.select')

    // Refresh cursor
    this.onMove()

    // Update texture offset
    this.setTextureOffset(this.texture)
  }

  activate() {
    this.pointerPredicateCache = {
      pointerUp: this.scene.pointerUpPredicate,
      pointerDown: this.scene.pointerDownPredicate,
    }
    // Predicate defines which objects are included in the picklist
    this.scene.pointerMovePredicate = this.scene.pointerUpPredicate = this.scene.pointerDownPredicate = this.predicate.bind(this)

    this.selection.start = undefined
    this.selection.end = undefined

    this.enabled.value = true

    this.scene.onPointerObservable.add(this.onPointerObservable)

    if (this.selection.mode == SelectionMode.Add) {
      // notify that build tool just got activated
      this.onBuildToolActivate.notifyObservers()
    }

    // Update palette color on activation
    this.updatePaletteColor()
  }

  predicate(mesh: BABYLON.AbstractMesh): boolean {
    if (!(mesh.name && mesh.isVisible && mesh.isPickable)) return false
    return mesh.name.startsWith('voxel-field/collider') || mesh.name.startsWith('voxelizer/')
  }

  deactivate() {
    // reset predicates to defaults
    if (this.pointerPredicateCache) {
      this.scene.pointerUpPredicate = this.pointerPredicateCache.pointerUp
      this.scene.pointerDownPredicate = this.pointerPredicateCache.pointerDown
      this.pointerPredicateCache = null
    }
    this.scene.pointerMovePredicate = this.controls.defaultPointerMovePredicate

    this.enabled.value = false
    this.mousedown = false
    this.box.visibility = 0
    this.box.scaling.set(1, 1, 1)
    this.clones.forEach((c) => c.dispose())
    this.clones.length = 0
    this.scene.onPointerObservable.removeCallback(this.onPointerObservable)
  }

  async placeBlocks(parcel: Parcel, a: BABYLON.Vector3, b: BABYLON.Vector3, block: number) {
    const bounds = this.getBounds(a, b)
    const { minimum, maximum } = bounds

    const voxelsPatch: [x: number, y: number, z: number][] = []
    for (let x = minimum.x; x <= maximum.x; x++) {
      for (let y = minimum.y; y <= maximum.y; y++) {
        for (let z = minimum.z; z <= maximum.z; z++) {
          voxelsPatch.push([Math.round(x - 1), Math.round(y - 2), Math.round(z - 1)])
        }
      }
    }
    parcel.set(voxelsPatch, block)
  }

  onPointerObservable(eventData: BABYLON.PointerInfo) {
    const pickInfo = eventData.pickInfo
    if (!pickInfo) return
    switch (eventData.type) {
      case BABYLON.PointerEventTypes.POINTERDOWN:
        // Left-click only
        if (eventData.event.button === 0) {
          this.onLeftPointerDown(eventData.event, pickInfo)
        }
        break

      case BABYLON.PointerEventTypes.POINTERUP:
        // console.log('pointerup!?', eventData.event)
        // Left-click only
        if (eventData.event.button === 0) {
          this.onLeftPointerUp(eventData.event, pickInfo)
        }
        break

      case BABYLON.PointerEventTypes.POINTERMOVE:
        this.onMove(pickInfo)
        break
    }
  }

  async onLeftPointerDown(e: BABYLON.IMouseEvent, pickResult: BABYLON.PickingInfo) {
    this.audio?.playSound('build.extend')

    this.selection.start = undefined
    this.selection.end = undefined
    this.selection.count = 1
    this.onMove(pickResult)

    this.mousedown = true
  }

  async onLeftPointerUp(e: BABYLON.IMouseEvent, pickResult: BABYLON.PickingInfo) {
    if (this.selection.start && this.selection.parcel) {
      let block: number

      if (this.selection.mode === SelectionMode.Remove) {
        block = 0
      } else {
        block = this.blockId
      }

      if (!this.selection.end) {
        this.selection.end = this.selection.start
      }

      this.placeBlocks(this.selection.parcel, this.selection.start, this.selection.end, block)
      this.audio?.playSound('build.place')
      this.onMove(pickResult)
    }

    this.mousedown = false
  }

  checkValidBlockSelection() {
    if (!this.selection.start || !this.selection.end) return false
    return this.selection.start.y === this.selection.end.y || this.selection.start.x === this.selection.end.x || this.selection.start.z === this.selection.end.z
  }

  onMove(pickResult?: BABYLON.PickingInfo) {
    // Preseve last selected element so that onMove() can be re-triggered to refresh editor display
    if (pickResult === undefined) {
      pickResult = this.lastOnMovePickResult
    } else {
      this.lastOnMovePickResult = pickResult
    }
    if (!pickResult) return

    if (this.ui?.visible) {
      // Force deactivate
      this.deactivate()
      return
    }

    // todo - repick on keypress but no mousemove

    // When we activate remove mode from the "Activate Erase Tool" we don't want to update the tool
    // using keyboard controls
    if (!this.selection.fixedMode) {
      // TODO: rewrite this to use a much better method of switching modes on keypress instead of on mouse move

      if (this.controls.shiftKey) {
        this.selection.mode = SelectionMode.Remove
      } else if (this.controls.ctrlKey) {
        this.selection.mode = SelectionMode.Paint
      } else {
        this.selection.mode = SelectionMode.Add
      }
    }

    // Clear previous clones
    this.clones.forEach((c) => c.dispose())
    this.clones.length = 0

    const voxelCenter = this.getVoxelCenter(pickResult, this.selection.mode)

    if (!voxelCenter) {
      this.box.visibility = 0
      return
    }

    const voxelPickInfo = this.pickVoxel(voxelCenter, pickResult?.getNormal())

    if (!voxelPickInfo) {
      this.box.visibility = 0
      return
    }

    if (this.mousedown) {
      // ensure parcels match to avoid wrap around when drawing between parcels
      if (voxelPickInfo.parcel == this.selection.parcel) {
        this.selection.end = voxelPickInfo.position.clone()
      }
    } else {
      this.selection.start = voxelPickInfo.position.clone()
      this.selection.end = undefined
      this.selection.parcel = voxelPickInfo.parcel
    }

    // Update material when parcel changes
    if (this.selection.parcel && this.selection.parcel !== this.lastParcel) {
      this.lastParcel = this.selection.parcel
      this.updateMaterialForParcel(this.selection.parcel).catch((err) => {
        console.error('Failed to update material for parcel:', err)
      })
    }

    if (!this.selection.start || !this.selection.parcel) {
      return
    }

    // Position the main box at the start of selection
    const a = this.voxelToWorldSpace(this.selection.start, this.selection.parcel)
    if (a) {
      this.box.position.copyFrom(a)
      this.box.scaling.set(1, 1, 1)
      this.box.visibility = 1
    }

    // For multi-voxel selection, create clones at each position (skip first, use main box)
    if (this.checkValidBlockSelection() && this.selection.end) {
      const bounds = this.getBounds(this.selection.start, this.selection.end)
      const { minimum, maximum } = bounds

      let isFirst = true
      for (let x = minimum.x; x <= maximum.x; x++) {
        for (let y = minimum.y; y <= maximum.y; y++) {
          for (let z = minimum.z; z <= maximum.z; z++) {
            const voxelPosition = new BABYLON.Vector3(x, y, z)
            const worldPosition = this.voxelToWorldSpace(voxelPosition, this.selection.parcel)

            if (worldPosition) {
              if (isFirst) {
                // Use the main box for the first position
                this.box.position.copyFrom(worldPosition)
                isFirst = false
              } else {
                // Create clones for additional positions
                const clone = this.box.clone('selection-box-clone')
                clone.position.copyFrom(worldPosition)
                clone.parent = this.parent
                clone.isPickable = false
                clone.visibility = 1
                this.clones.push(clone)
              }
            }
          }
        }
      }

      // Track selection count for audio feedback
      const totalCount = 1 + this.clones.length
      if (totalCount !== this.selection.count) {
        this.selection.count = totalCount
        this.audio?.playSound('build.extend')
      }
    }
  }

  getBounds(a: BABYLON.Vector3, b: BABYLON.Vector3): BABYLON.BoundingBox {
    const x1 = Math.min(a.x, b.x)
    const x2 = Math.max(a.x, b.x)
    const y1 = Math.min(a.y, b.y)
    const y2 = Math.max(a.y, b.y)
    const z1 = Math.min(a.z, b.z)
    const z2 = Math.max(a.z, b.z)

    return new BABYLON.BoundingBox(new BABYLON.Vector3(x1, y1, z1), new BABYLON.Vector3(x2, y2, z2))
  }

  getVoxelCenter(pickResult: BABYLON.PickingInfo, mode: SelectionMode): BABYLON.Vector3 | null {
    if (!pickResult || !pickResult.pickedPoint || !pickResult.getNormal()) {
      return null
    }

    const v = pickResult.pickedPoint.clone()
    const multiplier = mode === SelectionMode.Remove || mode === SelectionMode.Paint ? 0.25 : -0.25
    const norm = pickResult.getNormal()
    if (norm) v.subtractInPlace(norm.multiplyByFloats(multiplier, multiplier, multiplier))

    const trunc = (a: number) => Math.round(a * 2) / 2
    v.x = trunc(v.x)
    v.y = trunc(v.y)
    v.z = trunc(v.z)

    return v
  }

  // getParcel may match multiple parcels (because I suck
  // at maths, so we need to find the one whereupon this
  // is a valid voxel coordinate)
  pickVoxel(v: BABYLON.Vector3, normal: BABYLON.Nullable<BABYLON.Vector3> | undefined): VoxelPickingInfo | undefined {
    let parcel = null
    let position: BABYLON.Vector3 | null = null

    this.user.getParcels(v).forEach((p) => {
      if (!p.voxelMesh) {
        console.warn('pickVoxel: Parcel not meshed')
        return undefined
      }

      const pos = v.clone().subtractInPlace(p.voxelMesh.position).subtractInPlace(p.transform.position).multiplyByFloats(2, 2, 2)

      // pos is accurate position of the voxel which at ground level is y=2
      // However because the placeholder is at 2 we create a clone of the pos vector
      // and offset its y by -2 so that it makes more sense code wise
      const tmp_position = pos.clone()
      tmp_position.y -= 2

      // Standard procedure, if pick is above ground, allow edit.
      const isPickAboveGround = tmp_position.y > 0 && tmp_position.x > 0 && tmp_position.z > 0
      // This is to allow the parcel builder to edit the bottom floor if the Unit is mergeable.
      const isMergeableFloorEdit = p.isMergeableUnit()
      // However, if there is a hole between the parcels, AND we're trying to add a cube to hide the hole, allow it
      // This is to make sure that a user is able to close the hole between parcels if he doesn't own the bottom/top one
      // This case arise if a user has both parcels and sells one of them; you end up with 2 merged parcels with different owners.
      // CONS: once a block is placed we can't edit it.
      const floorIsCloseable = this.selection.mode === SelectionMode.Add && normal && (!!Math.abs(normal.z) || !!Math.abs(normal.x))
      if (isPickAboveGround || isMergeableFloorEdit || floorIsCloseable) {
        parcel = p
        position = pos
      }
    })

    if (!parcel || !position) {
      return undefined
    }

    return { position, parcel }
  }

  voxelToWorldSpace(position: BABYLON.Vector3, parcel: Parcel): BABYLON.Vector3 | undefined {
    if (!parcel.voxelMesh) {
      console.warn('voxelToWorldSpace: Parcel not meshed')
      return undefined
    }

    // offset due to voxelMesh.position.y = -1
    //result.y += 1
    return position.clone().multiplyByFloats(0.5, 0.5, 0.5).addInPlace(parcel.voxelMesh.position).addInPlace(parcel.transform.position)
  }
}
