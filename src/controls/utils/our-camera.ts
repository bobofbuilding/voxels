/**
 * This represents a free type of camera. It can be useful in First Person Shooter game for instance.
 * Please consider using the new UniversalCamera instead as it adds more functionality like the gamepad.
 * @see https://doc.babylonjs.com/features/cameras#universal-camera
 */

const FRAME_DURATION_AT_60_FPS = 1000 / 60 // ms
export default class OurCamera extends BABYLON.TargetCamera {
  public inertiaVector = new BABYLON.Vector3(0, 0, 0)
  /**
   * Define the collision ellipsoid of the camera.
   * This is helpful to simulate a camera body like the player body around the camera
   * @see https://doc.babylonjs.com/babylon101/cameras,_mesh_collisions_and_gravity#arcrotatecamera
   */
  public ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5)

  /**
   * Define an offset for the position of the ellipsoid around the camera.
   * This can be helpful to determine the center of the body near the gravity center of the body
   * instead of its head.
   */
  public ellipsoidOffset = new BABYLON.Vector3(0, 0.1, 0)

  /**
   * Enable or disable collisions of the camera with the rest of the scene objects.
   */
  public checkCollisions = false

  /**
   * Enable or disable gravity on the camera.
   */
  public applyGravity = false

  /**
   * Define the input manager associated to the camera.
   */
  public inputs: BABYLON.FreeCameraInputsManager
  /**
   * Event raised when the camera collide with a mesh in the scene.
   */
  public onCollide: (collidedMesh: BABYLON.AbstractMesh) => void = undefined!
  /** @hidden */
  public _localDirection: BABYLON.Vector3 = undefined!
  /** @hidden */
  public _transformedDirection: BABYLON.Vector3 = undefined!
  parabolic: boolean = undefined!
  private _collider: BABYLON.Collider = undefined!
  private _needMoveForGravity = false
  private _oldPosition = BABYLON.Vector3.Zero()
  private _diffPosition = BABYLON.Vector3.Zero()
  private _newPosition = BABYLON.Vector3.Zero()

  /**
   * Instantiates a Free Camera.
   * This represents a free type of camera. It can be useful in First Person Shooter game for instance.
   * Please consider using the new UniversalCamera instead as it adds more functionality like touch to this camera.
   * @see https://doc.babylonjs.com/features/cameras#universal-camera
   * @param name Define the name of the camera in the scene
   * @param position Define the start position of the camera in the scene
   * @param scene Define the scene the camera belongs to
   * @param setActiveOnSceneIfNoneActive Defines whether the camera should be marked as active if not other active cameras have been defined
   */
  constructor(name: string, position: BABYLON.Vector3, scene?: BABYLON.Scene, setActiveOnSceneIfNoneActive = true) {
    super(name, position, scene, setActiveOnSceneIfNoneActive)
    this.inputs = new BABYLON.FreeCameraInputsManager(this as any as BABYLON.FreeCamera) // todo check the types here, and remove the any
    this.inputs.addMouse()
  }

  /**
   * Gets the input sensibility for a mouse input. (default is 2000.0)
   * Higher values reduce sensitivity.
   */
  public get angularSensibility(): number {
    const mouse = <BABYLON.FreeCameraMouseInput>this.inputs.attached['mouse']
    if (mouse) {
      return mouse.angularSensibility
    }

    return 0
  }

  /**
   * Sets the input sensibility for a mouse input. (default is 2000.0)
   * Higher values reduce sensitivity.
   */
  public set angularSensibility(value: number) {
    const mouse = <BABYLON.FreeCameraMouseInput>this.inputs.attached['mouse']
    if (mouse) {
      mouse.angularSensibility = value
    }
  }

  // Collisions
  private _collisionMask = -1

  /**
   * Define a collision mask to limit the list of object the camera can collide with
   */
  public get collisionMask(): number {
    return this._collisionMask
  }

  public set collisionMask(mask: number) {
    this._collisionMask = !isNaN(mask) ? mask : -1
  }

  /**
   * Attach the input controls to a specific dom element to get the input from.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  public attachControl(noPreventDefault?: boolean): void

  /**
   * Attach the input controls to a specific dom element to get the input from.
   * @param ignored defines an ignored parameter kept for backward compatibility.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   * BACK COMPAT SIGNATURE ONLY.
   */
  public attachControl(ignored: any, noPreventDefault?: boolean): void

  /**
   * Attached controls to the current camera.
   * @param ignored defines an ignored parameter kept for backward compatibility.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  public attachControl(ignored?: any, noPreventDefault?: boolean): void {
    // eslint-disable-next-line prefer-rest-params
    noPreventDefault = BABYLON.Tools.BackCompatCameraNoPreventDefault(arguments)
    this.inputs.attachElement(noPreventDefault)
  }

  /**
   * Detach the current controls from the specified dom element.
   */
  public detachControl(): void {
    this.inputs.detachElement()

    this.cameraDirection = new BABYLON.Vector3(0, 0, 0)
    this.cameraRotation = new BABYLON.Vector2(0, 0)
  }

  /**
   * @param displacement
   * @hidden
   */
  public _collideWithWorld(displacement: BABYLON.Vector3): void {
    let globalPosition: BABYLON.Vector3

    if (this.parent) {
      globalPosition = BABYLON.Vector3.TransformCoordinates(this.position, this.parent.getWorldMatrix())
    } else {
      globalPosition = this.position
    }

    globalPosition.subtractFromFloatsToRef(0, this.ellipsoid.y, 0, this._oldPosition)
    this._oldPosition.addInPlace(this.ellipsoidOffset)

    const coordinator = this.getScene().collisionCoordinator
    if (!this._collider) {
      this._collider = coordinator.createCollider()
    }

    this._collider._radius = this.ellipsoid
    this._collider.collisionMask = this._collisionMask

    //no need for clone, as long as gravity is not on.
    let actualDisplacement = displacement

    //add gravity to the direction to prevent the dual-collision checking
    if (this.applyGravity) {
      //this prevents mending with cameraDirection, a global variable of the free camera class.
      actualDisplacement = displacement.clone()

      let inertiaVectorY = this.inertiaVector.y

      // if this.inertiaVector.y is negative, then we are falling. factor in render time so that fall speed isn't affected by frame rate.
      if (inertiaVectorY < 0) {
        const currentFPSMultipleOfTargetFPS = FRAME_DURATION_AT_60_FPS / this.getEngine().getDeltaTime()
        inertiaVectorY = inertiaVectorY / currentFPSMultipleOfTargetFPS
      }

      actualDisplacement.y = inertiaVectorY - 0.01
    }

    coordinator.getNewPosition(this._oldPosition, actualDisplacement, this._collider, 3, null, this._onCollisionPositionChange, this.uniqueId)
  }

  jump() {
    if (this.inertiaVector.y === 0) {
      this.inertiaVector.y = 0.1
    }
  }

  /** @hidden */
  public _checkInputs(): void {
    if (!this._localDirection) {
      this._localDirection = BABYLON.Vector3.Zero()
      this._transformedDirection = BABYLON.Vector3.Zero()
    }

    this.inputs.checkInputs()

    super._checkInputs()
  }

  /** @hidden */
  public _decideIfNeedsToMove(): boolean {
    return true // this._needMoveForGravity || Math.abs(this.cameraDirection.x) > 0 || Math.abs(this.cameraDirection.y) > 0 || Math.abs(this.cameraDirection.z) > 0;
  }

  /** @hidden */
  public _updatePosition(): void {
    if (this.checkCollisions && this.getScene().collisionsEnabled) {
      this._collideWithWorld(this.cameraDirection)
    } else {
      super._updatePosition()
    }
  }

  /**
   * Destroy the camera and release the current resources hold by it.
   */
  public dispose(): void {
    this.inputs.clear()
    super.dispose()
  }

  /**
   * Gets the current object class name.
   * @return the class name
   */
  public getClassName(): string {
    return 'FreeCamera'
  }

  private _onCollisionPositionChange = (collisionId: number, newPosition: BABYLON.Vector3, collidedMesh: BABYLON.Nullable<BABYLON.AbstractMesh> = null) => {
    const EPSILON = 0.001

    this.parabolic = Math.abs(newPosition.y - this._oldPosition.y) > EPSILON

    if (this.parabolic) {
      this.inertiaVector.y -= 0.003
    } else {
      this.inertiaVector.y = 0
    }
    const updatePosition = (newPos: BABYLON.Vector3) => {
      this._newPosition.copyFrom(newPos)

      this._newPosition.subtractToRef(this._oldPosition, this._diffPosition)

      if (this._diffPosition.length() > BABYLON.Engine.CollisionsEpsilon) {
        this.position.addInPlace(this._diffPosition)
        if (this.onCollide && collidedMesh) {
          this.onCollide(collidedMesh)
        }
      }
    }

    updatePosition(newPosition)
  }
}
