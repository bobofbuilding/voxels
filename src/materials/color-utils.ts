export type ColorInput = [number, number, number] | string | BABYLON.Vector3 | BABYLON.Color3

export function toColor3(color: ColorInput): BABYLON.Color3 {
  if (Array.isArray(color)) return BABYLON.Color3.FromArray(color)
  if (typeof color === 'string') return BABYLON.Color3.FromHexString(color)
  if (color instanceof BABYLON.Vector3) return new BABYLON.Color3(color.x, color.y, color.z)
  if (color instanceof BABYLON.Color3) return color
  // Fallback to white if input is invalid
  console.warn('Invalid color input, defaulting to white')
  return new BABYLON.Color3(1, 1, 1)
}
