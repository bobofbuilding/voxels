import { round, XYZ } from '../../../../../src/utils/helpers'
import { axisValues } from './axis-values'

export const getNextScale = (axisChanged: XYZ, aspectRatioLocked: boolean, featureScaleAxes: XYZ[], scaleValues: axisValues, previousValues: axisValues, value: any) => {
  const parsedValue = parseFloat(value)

  const axesToUpdate = aspectRatioLocked ? featureScaleAxes : [axisChanged]

  return axesToUpdate.reduce((accumulator: { [key: string]: number }, axis: XYZ) => {
    // the axis that was changed by the user is the same as the iterate axis
    // so just update it.
    if (axis === axisChanged) {
      accumulator[axis] = parsedValue
    } else if (scaleValues[axisChanged] !== 0) {
      // the iterate axis is NOT the axis edited by the user.
      // the current value for the user edited input is non-zero,
      // so we can easily get the aspect ratio.

      // if the iterate axis current value is zero- we are giving it a small default value
      // this is because when the iterate axis value is zero, the aspect ratio is zero.
      // this would result in no change to the iterate axis.
      // however, I think the user expects the axis to update even if it is zero-
      // hence the small default, to give us a non-zero aspect ratio
      const aspectRatio = (scaleValues[axis] || 0.1) / scaleValues[axisChanged]
      accumulator[axis] = round(parsedValue * aspectRatio, 6)
    } else if (previousValues[axisChanged] !== 0) {
      // if the current value of the changed axis is zero, we cant use it to calculate
      // an aspect ratio- because we would be dividing by zero! A bit of a mathy nono.
      // so we leverage the previousValues to see what the aspect ratio was for
      // the last update, and use that.
      const aspectRatio = previousValues[axis] / previousValues[axisChanged]
      accumulator[axis] = scaleValues[axis] + round(previousValues[axisChanged] * aspectRatio, 6)
    } else if (scaleValues[axis]) {
      // the current value for the changed axis is zero-
      // AND also the previous value for the changed axis is zero
      // but the axis to be changed has a positive value.
      // there is no possible aspect ratio in this scenario-
      // so lets try and match the users expectations in a different way.

      // the value is a delta, since the old value is zero
      const delta = Number(value)
      // how big is the iterate axis, compared to the delta?
      const factor = Math.abs(scaleValues[axis]) / Math.abs(delta)
      // update the iterate axis proportionally
      const newValue = scaleValues[axis] + delta * factor
      accumulator[axis] = round(newValue, 6)
    } else {
      // the current value for the changed axis is zero-
      // AND also the previous value for the changed axis is zero
      // AND the iterate axis is zero
      // well then, lets just update everything in lockstep.
      accumulator[axis] = parsedValue
    }
    return accumulator
  }, {}) as any
}
