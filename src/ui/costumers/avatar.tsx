import { Component, h } from 'preact'
import { Costume } from '../../../common/messages/costumes'

interface Props {
  costume: Costume | null
  children?: h.JSX.Element[] | null
  scene: BABYLON.Scene
  dance?: string
}

interface State {
  loaded: boolean
}

export default class Avatar extends Component<Props, State> {
  state: State = {
    loaded: false,
  }
  private material: BABYLON.Nullable<BABYLON.StandardMaterial> = null
  private meshes: BABYLON.Nullable<BABYLON.AbstractMesh>[] = []
  private boneMeshes: BABYLON.Nullable<BABYLON.AbstractMesh>[] = []

  componentDidMount() {
    this.generateAvatar().then(() => this.setState({ loaded: true }))
  }

  componentDidUpdate(previousProps: Readonly<Props>): void {
    if (previousProps.dance != this.props.dance || previousProps.costume?.id !== this.props.costume?.id) {
      this.dispose()
      this.generateAvatar()
    }
  }

  componentWillUnmount() {
    this.dispose()
  }

  generateAvatar() {
    const scene = this.props.scene

    return new Promise<void>((resolve, reject) => {
      BABYLON.SceneLoader.ImportMesh(
        null,
        `/models/`,
        'avatar.glb',
        scene,
        (meshes, particleSystems, skeletons) => {
          this.dispose()

          const material = new BABYLON.StandardMaterial(`material/costume`, scene)
          material.diffuseColor.set(0.82, 0.81, 0.8)
          material.emissiveColor.set(0.1, 0.1, 0.1)
          material.specularPower = 1000
          material.blockDirtyMechanism = true
          this.material = material

          this.meshes = meshes
          const mesh = meshes[0] as BABYLON.Mesh
          mesh.id = `costume/${this.props.costume?.id}`
          mesh.visibility = 0
          mesh.isPickable = false

          const armature = meshes[1] as BABYLON.Mesh
          armature.material = material
          armature.isPickable = false

          this.applySkin()

          const skeleton = skeletons[0]

          // @ts-expect-error for debugging?
          window['skeleton'] = skeleton

          const bones = skeleton.bones.filter((b: BABYLON.Bone) => !b.name.match(/index/i))
          const hips = bones[0]
          hips.getTransformNode()?.rotate(BABYLON.Axis.Y, Math.PI)

          bones.forEach((b) => {
            const m = BABYLON.MeshBuilder.CreateSphere('bonesphere', { diameter: 0.15 }, scene)
            this.boneMeshes.push(m)
            m.id = 'bonesphere'
            m.attachToBone(b, armature)
            m.metadata = b.name.replace(/^.+:/, '')
            const mat = new BABYLON.StandardMaterial(b.name, scene)
            mat.emissiveColor.set(1, 1, 1)
            mat.disableLighting = true
            mat.alpha = 0.5
            mat.blockDirtyMechanism = true
            m.material = mat
            m.renderingGroupId = 2
            m.setEnabled(false)
          })

          this.setState({ loaded: true })

          if (!this.props.dance) {
            return resolve()
          }

          // these 'natural' animations are all located in the same file and needs special handling
          const naturalAnimations = ['dance', 'floating', 'idle', 'jump', 'run', 'walk']
          let sceneFileName = `${this.props.dance?.toLowerCase()}.glb`
          if (naturalAnimations.includes(this.props.dance.toLowerCase())) {
            sceneFileName = 'all-actions.glb'
          }
          BABYLON.SceneLoader.ImportMeshAsync(null, '/animations/', sceneFileName, scene).then((imported) => {
            imported.meshes.forEach((m) => m.dispose())
            const groups = this.copy(imported.animationGroups, skeleton)
            const found = groups.find((ag) => ag.name.toLowerCase() === this.props.dance?.toLowerCase())
            const animation = found || groups[0]
            animation.play()
            animation.loopAnimation = true
            const parent = new BABYLON.TransformNode('transform', scene)
            mesh.parent = parent
            parent.rotation.y = Math.PI
            resolve()
          })
        },
        undefined,
        reject,
      )
    })
  }

  copy(groups: BABYLON.AnimationGroup[], target: BABYLON.Skeleton) {
    const lookup: Record<string, BABYLON.Nullable<BABYLON.TransformNode>> = {}
    target.bones.forEach((bone) => (lookup[bone.name] = bone.getTransformNode()))

    groups.forEach((group) => {
      group.targetedAnimations.forEach((targetedAnimationsKey) => {
        targetedAnimationsKey.animation.blendingSpeed = 0.1
        targetedAnimationsKey.animation.enableBlending = true
        const boneNode = lookup[targetedAnimationsKey.target.name]
        if (!boneNode) {
          return
        }

        if (boneNode.id.split('.')[0] == 'Clone of origami:Hips') {
          // If it's the hip bone, copy bone rotation and position (everything BUT scaling)
          if (targetedAnimationsKey.animation.targetProperty != 'scaling') {
            targetedAnimationsKey.target = boneNode
          }
        } else {
          // Only copy bone rotation
          if (targetedAnimationsKey.animation.targetProperty == 'rotationQuaternion') {
            targetedAnimationsKey.target = boneNode
          }
        }
      })
    })

    return groups
  }

  applySkin() {
    if (!this.material) {
      return
    }
    const scene = this.props.scene
    if (this.props.costume?.skin) {
      const encodedData = 'data:image/svg+xml;base64,' + window.btoa(this.props.costume.skin)
      const texture = BABYLON.Texture.LoadFromDataString(`texture/costume/${this.props.costume.id}`, encodedData, scene, false, false, false)
      this.material.diffuseTexture = texture
      texture.hasAlpha = true
    } else {
      this.material.diffuseTexture = null
    }
  }

  render() {
    return <div>{this.state.loaded && this.props.children}</div>
  }

  private dispose() {
    this.material?.dispose(false, true)
    this.meshes.forEach((m) => m?.dispose(false, true))
    this.boneMeshes.forEach((m) => m?.dispose(false, true))
  }
}
