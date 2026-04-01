import * as Comlink from 'comlink'
import type { FontData, PolyTextJob, PolyTextJobData, PolytextRenderJobResult } from './polytext-v2-worker'

const { UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS } = require('../../vendor/library/urls.js')

export interface PolytextWorkerAPI {
  setFontData(fontData: FontData): void
  meshText(text: string, renderJob: number): Promise<PolytextRenderJobResult>
}

let data: FontData | null = null

if ('function' === typeof importScripts) {
  importScripts(UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS)
}

const engine = new BABYLON.NullEngine()

const nullScene = new BABYLON.Scene(engine)

const meshText = async (text: string, renderJob: number): Promise<PolytextRenderJobResult> => {
  if (!data) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return meshText(text, renderJob)
  }

  const meshes = []
  let x = 0

  for (const ch of text) {
    const char = data.chars.find((letter) => letter.name === ch)

    if (!char || !char.data) {
      x += 0.5 // space - missing character
    } else {
      const mesh = new BABYLON.Mesh('character-' + ch, nullScene)
      const vdata = new BABYLON.VertexData()

      vdata.positions = char.data.positions
      vdata.uvs = char.data.uvs
      vdata.indices = char.data.indices.slice()
      vdata.normals = char.data.normals
      vdata.applyToMesh(mesh)

      mesh.position.x = x

      x += char.advanceWidth // fixme - get width of character

      // mesh.bakeCurrentTransformIntoVertices()

      meshes.push(mesh)
    }
  }

  let mesh: BABYLON.Mesh | null = null

  try {
    mesh = BABYLON.Mesh.MergeMeshes(meshes)
    if (!mesh) {
      throw new Error('Failed to merge meshes')
    }
  } catch (e) {
    console.error(e)
    throw new Error('Failed to merge polytext meshes')
  }

  mesh.position.y += 0.25
  mesh.scaling.x = 4
  mesh.scaling.z = 8

  mesh.bakeCurrentTransformIntoVertices()

  const v = BABYLON.VertexData.ExtractFromMesh(mesh)

  // Create transferrable objects
  const positions = v.positions ? Array.from(new Float32Array(v.positions)) : []
  const indices = v.indices ? Array.from(new Float32Array(v.indices)) : []
  const uvs = v.uvs ? Array.from(new Float32Array(v.uvs)) : [] // positions.length / 3 * 2)

  // for (let i = 0 ; i < positions.length / 3; i++) {
  //   uvs[i * 2 + 0] = positions[i * 3 + 2]
  //   uvs[i * 2 + 1] = positions[i * 3 + 0]
  // }

  mesh.dispose()

  return { renderJob, positions, indices, uvs }
}

class PolytextWorker implements PolytextWorkerAPI {
  setFontData(fontData: FontData): void {
    data = fontData
  }

  async meshText(text: string, renderJob: number): Promise<PolytextRenderJobResult> {
    return meshText(text, renderJob)
  }
}

export const polytextWorker = new PolytextWorker()

if (typeof self !== 'undefined' && 'postMessage' in self) {
  Comlink.expose(polytextWorker)
}
