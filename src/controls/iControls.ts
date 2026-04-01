/**
 * interface to avoid circular dependencies
 */
export interface IControls {
  worldOffset: BABYLON.TransformNode
  disableGravity: () => void
  enableGravity: () => void
}
