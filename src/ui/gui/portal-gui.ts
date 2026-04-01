import Portal from '../../features/portal'
import { hasPointerLock, requestPointerLock } from '../../../common/helpers/ui-helpers'

export default class PortalTeleportGUI {
  scene: BABYLON.Scene
  portal: Portal
  plane: BABYLON.Mesh = undefined!
  advancedDynamicTexture: BABYLON.GUI.AdvancedDynamicTexture = undefined!
  grid: BABYLON.GUI.Grid = undefined!
  parent: BABYLON.TransformNode = undefined!

  constructor(scene: BABYLON.Scene, portal: Portal) {
    this.scene = scene
    this.portal = portal
  }

  get isSpaceWomp() {
    return !!this.portal.description.womp?.space_id
  }

  get parcelName() {
    const desc = this.portal.description
    return desc.womp?.parcel_name || desc.womp?.parcel_address || desc.womp?.space_name || desc.womp?.coords || 'location'
  }

  generate() {
    if (!this.portal.mesh) {
      return
    }
    // Create plane mesh
    this.plane = BABYLON.MeshBuilder.CreatePlane(
      'portal/gui',
      {
        width: 1,
        height: 0.5,
        sideOrientation: BABYLON.Mesh.FRONTSIDE,
      },
      this.scene,
    )
    this.plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y
    // Create parent transformNode
    this.parent = new BABYLON.TransformNode('feature/portal/parent', this.scene)
    this.parent.position.copyFrom(this.portal.mesh.getAbsolutePosition())
    this.plane.setParent(this.parent)
    const position_y = this.portal.mesh.scaling.y / 2 + 0.2

    this.plane.rotation.set(0, 0, 0)
    const s = 0.9
    this.plane.scaling.set(s, s, s)
    this.plane.position.set(0, position_y, 0)

    // GUI
    const advancedDynamicTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.plane, 512, 128)
    advancedDynamicTexture.hasAlpha = true
    this.advancedDynamicTexture = advancedDynamicTexture
    // Create grid for the GUI
    this.grid = new BABYLON.GUI.Grid()
    advancedDynamicTexture.addControl(this.grid)
    this.grid.addColumnDefinition(1)

    this.grid.addRowDefinition(0.5)
    this.grid.addRowDefinition(0.5)

    this.redrawGUI()
  }

  // Refresh the GUI on edit of the portal.
  refresh() {
    if (this.advancedDynamicTexture) {
      this.dispose()
      this.generate()
    }
  }

  teleportUser = () => {
    if (hasPointerLock() && this.portal.coordinatesUrl) {
      this.dispose()
      if (this.portal.isPortalToAnotherRealm()) {
        window.ui?.openLink(this.portal.coordinatesUrl)
      } else {
        window.persona.teleport(this.portal.coordinatesUrl)
      }
    } else {
      requestPointerLock()
    }
  }

  redrawGUI() {
    if (!this.grid) {
      return
    }

    this.grid.clearControls()

    this.grid.fontFamily = "'helvetica neue', sans-serif"
    this.grid.fontWeight = 'bold'
    this.grid.fontSize = '44px'

    const name = this.parcelName

    const text = new BABYLON.GUI.TextBlock()
    text.text = name
    text.textWrapping = 2
    text.height = '50px'
    text.color = 'white'
    //text.fontSize = 12

    this.grid.addControl(text, 0, 0)

    //Create button
    const button = BABYLON.GUI.Button.CreateSimpleButton('teleport_button', 'Click to teleport')
    button.width = text.width
    button.height = '50px'
    button.color = '#333'
    button.isPointerBlocker = true
    button.cornerRadius = 8
    button.background = 'White'
    button.onPointerUpObservable.add(this.teleportUser)
    this.grid.addControl(button, 1, 0)

    this.advancedDynamicTexture.update(true)
  }

  dispose() {
    if (this.advancedDynamicTexture) {
      this.plane?.dispose()
      this.parent?.dispose()
      this.grid?.dispose()
      this.advancedDynamicTexture.dispose()
      this.advancedDynamicTexture = null!
    }
  }
}
