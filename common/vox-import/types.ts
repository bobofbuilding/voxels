export type VoxModel = {
  materials: { h: { _d: string; _ior: string; _rough: string; _type: string } }[]
  models: { colorIndex: number; x: number; y: number; z: number }[][]
  nodeGraph: object
  palette: { a: number; b: number; g: number; r: number }[]
  sizes: { x: number; y: number; z: number }[]
}
