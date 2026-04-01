/*
 * Only clear vertex data if we are not colliding with it
 */

export function overrideClearCachedVertexData(scene: BABYLON.Scene) {
  scene['clearCachedVertexData'] = function() {
    for (let meshIndex = 0; meshIndex < this.meshes.length; meshIndex++) {
      const mesh = <BABYLON.Mesh>this.meshes[meshIndex]
      const geometry = mesh.geometry

      if (mesh.checkCollisions) {
        return
      }

      if (geometry) {
        geometry._indices = []

        for (const vbName in geometry._vertexBuffers) {
          if (!geometry._vertexBuffers.hasOwnProperty(vbName)) {
            continue
          }
          geometry._vertexBuffers[vbName]._buffer._data = null
        }
      }
    }
  }
}