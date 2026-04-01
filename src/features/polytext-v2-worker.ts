// Polytext worker to generate polytext meshes letter by letter.
// Potential improvements to do in the future:
// - Recycle the letters (instead of generating the letters every single time, save a root mesh and clone it
//   every other time we receive the same letter); I tried implementing this but 20% of the time we receive weird looking letter meshes.
// - Use `import 'babylonjs'` instead of importScript. Not all browsers support mobule workers so not really doable now (maybe we can detect support and import conditionally);

import * as Comlink from 'comlink'

const { UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS } = require('../../vendor/library/urls.js')

export type FontData = {
  chars: { name: string; data: { indices: number[]; normals: number[]; positions: number[]; uvs: number[] }; advanceWidth: number }[]
}

export type PolytextRenderJobResult = { renderJob: number; positions: number[]; indices: number[]; uvs: number[] }

export interface PolytextV2WorkerAPI {
  setFontData(fontData: FontData): void
  meshText(text: string, renderJob: number): Promise<PolytextRenderJobResult>
}

let data: FontData | null = null

if ('function' === typeof importScripts) {
  importScripts(UNBUNDLED_BABYLON_LIB_URL_FOR_WEB_WORKERS)
}
export type PolyTextJobData = { type: 'data'; font: FontData }
export type PolyTextJob = { type: 'job'; renderJob: number; text: string }

const engine = new BABYLON.NullEngine()

const scene = new BABYLON.Scene(engine)

const meshTextv2 = async (text: string, renderJob: number): Promise<PolytextRenderJobResult> => {
  if (!data) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return meshTextv2(text, renderJob)
  }

  let meshes: BABYLON.Mesh[] = []
  let x = 0

  for (const ch of text) {
    const char = data.chars.find((letter) => letter.name === ch)

    if (!char || !char.data) {
      x += 0.5 // space - missing character
      continue
    }

    const newRootMesh = new BABYLON.Mesh('character-' + ch, scene)
    const vdata = new BABYLON.VertexData()
    vdata.positions = char.data.positions.slice()
    vdata.uvs = char.data.uvs.slice()
    vdata.indices = char.data.indices.slice()
    vdata.normals = char.data.normals.slice()

    vdata.applyToMesh(newRootMesh)

    const disposableMesh = newRootMesh.clone()
    disposableMesh.position.x = x

    x += char.advanceWidth

    meshes.push(disposableMesh)
  }

  let mesh: BABYLON.Mesh | null
  try {
    mesh = BABYLON.Mesh.MergeMeshes(meshes, true)
    if (!mesh) {
      throw new Error()
    }
  } catch (e) {
    meshes = []
    throw new Error('Failed to merge polytext meshes')
  }

  // Set appropriate rotation and origin BEFORE sending the vertices
  // That way the client doesn't have to care about re-orienting the mesh
  mesh.rotation.x = -Math.PI / 2
  mesh.rotation.y = -Math.PI / 2
  // get BB size
  const BB = mesh.getBoundingInfo()
  const width = BB.maximum.x - BB.minimum.x
  const depth = BB.maximum.z - BB.minimum.z

  mesh.position.set(depth / 2, 0, (-width * 4) / 2)
  mesh.scaling.x = 4
  mesh.scaling.z = 8

  mesh.bakeCurrentTransformIntoVertices()

  const v = BABYLON.VertexData.ExtractFromMesh(mesh)
  if (!v.positions || !v.indices || !v.uvs || !v.normals) {
    throw new Error('Polytext: Could not copy vertex data')
  }
  // Create transferrable objects
  const positions = Array.from(new Float32Array(v.positions))
  const indices = Array.from(new Float32Array(v.indices))
  const uvs = Array.from(new Float32Array(v.uvs))

  mesh.dispose()

  return { renderJob, positions, indices, uvs }
}

class PolytextV2Worker implements PolytextV2WorkerAPI {
  setFontData(fontData: FontData): void {
    data = fontData
  }

  async meshText(text: string, renderJob: number): Promise<PolytextRenderJobResult> {
    return meshTextv2(text, renderJob)
  }
}

export const polytextV2Worker = new PolytextV2Worker()

if (typeof self !== 'undefined' && 'postMessage' in self) {
  Comlink.expose(polytextV2Worker)
}
