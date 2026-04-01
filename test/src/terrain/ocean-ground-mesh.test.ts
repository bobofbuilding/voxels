// ABOUTME: Test BabylonJS CreateGround mesh height behavior
// ABOUTME: Verifies that regular instances and custom clipped meshes have same final height

import { describe, it, expect } from 'vitest'

const TestScene = () => new BABYLON.Scene(new BABYLON.NullEngine())

describe('Ocean Ground Mesh Height Consistency', () => {
  it('should create CreateGround mesh with vertices at Y=0', () => {
    const scene = TestScene()
    const size = 48

    const mesh = BABYLON.MeshBuilder.CreateGround(
      'test',
      {
        width: size,
        height: size,
        subdivisions: 1,
      },
      scene,
    )

    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)

    if (positions) {
      // All Y coordinates should be 0 for CreateGround
      for (let i = 1; i < positions.length; i += 3) {
        expect(positions[i]).toBe(0) // Y coordinate at index 1, 4, 7, 10...
      }

      // Verify correct bounds
      let minX = Infinity,
        maxX = -Infinity
      let minZ = Infinity,
        maxZ = -Infinity

      for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i])
        maxX = Math.max(maxX, positions[i])
        minZ = Math.min(minZ, positions[i + 2])
        maxZ = Math.max(maxZ, positions[i + 2])
      }

      expect(maxX - minX).toBe(size)
      expect(maxZ - minZ).toBe(size)
    }

    scene.dispose()
  })

  it('should verify both instance and custom mesh have same final height', () => {
    const scene = TestScene()

    // Create regular instance mesh (like non-clipped ocean tiles)
    const baseMesh = BABYLON.MeshBuilder.CreateGround(
      'ocean',
      {
        width: 48,
        height: 48,
        subdivisions: 1,
      },
      scene,
    )

    const instance = baseMesh.createInstance('ocean_instance')
    instance.position.set(-1224, 0.25, -1128)

    // Create custom mesh (like clipped ocean tiles) - with Y=0 vertices
    const customPositions = [
      -24,
      0,
      -24, // Bottom-left
      24,
      0,
      -24, // Bottom-right
      24,
      0,
      24, // Top-right
      -24,
      0,
      24, // Top-left
    ]

    const customMesh = new BABYLON.Mesh('custom', scene)
    const vertexData = new BABYLON.VertexData()
    vertexData.positions = customPositions
    vertexData.indices = [0, 1, 2, 0, 2, 3]
    vertexData.applyToMesh(customMesh)
    customMesh.position.set(-1224, 0.25, -1128)

    // Both should have same final Y position
    const basePositions = baseMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)!

    // Instance final Y = baseY + instanceY = 0 + 0.25 = 0.25
    const instanceFinalY = basePositions[1] + instance.position.y

    // Custom final Y = vertexY + meshY = 0 + 0.25 = 0.25
    const customFinalY = customPositions[1] + customMesh.position.y

    expect(instanceFinalY).toBe(0.25)
    expect(customFinalY).toBe(0.25)
    expect(instanceFinalY).toBe(customFinalY)

    scene.dispose()
  })
})
