import type Feature from '../feature'

export const boundingBoxesOfFeatures = (features: Array<Feature>): BABYLON.BoundingBox[] => {
  return features.map((feature: Feature) => feature.boundingBox).filter((boundingBox) => boundingBox) as BABYLON.BoundingBox[]
}

export const boundingBoxOfMesh = (mesh: BABYLON.AbstractMesh): BABYLON.BoundingBox => {
  const isTransformNode = (mesh: BABYLON.AbstractMesh) => {
    return mesh instanceof BABYLON.TransformNode && !mesh['getBoundingInfo']
  }

  // hack to allow highlight of polytext and other features that use a TransformNode
  // can't just check for transform node, because everything inherits from it
  if (isTransformNode(mesh)) {
    mesh = mesh.getChildren()[0] as BABYLON.AbstractMesh
  }
  // In some cases the child of the transform node is still a transform node; I assume this happens for groups in groups
  while (isTransformNode(mesh)) {
    try {
      mesh = mesh.getChildren()[0] as BABYLON.AbstractMesh
    } catch {
      console.warn('BoundingBoxOfMesh: Error in obtaining a mesh')
      break
    }
  }

  return mesh.getBoundingInfo().boundingBox
}

export const boundingBoxOfBoundingBoxes = (boundingBoxes: BABYLON.BoundingBox[]): BABYLON.BoundingBox => {
  if (boundingBoxes.length === 1) {
    boundingBoxes[0]
  }

  let { minimumWorld: min, maximumWorld: max } = boundingBoxes[0]

  for (let i = 0; i < boundingBoxes.length; i++) {
    const { minimumWorld: nextMix, maximumWorld: nextMax } = boundingBoxes[i]

    min = BABYLON.Vector3.Minimize(min, nextMix)
    max = BABYLON.Vector3.Maximize(max, nextMax)
  }

  return new BABYLON.BoundingBox(min, max)
}
