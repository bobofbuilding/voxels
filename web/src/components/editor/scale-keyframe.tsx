import { useEffect, useRef, useState } from 'preact/hooks'
import { JSXInternal } from 'preact/src/jsx'
import { truncate } from '../../../../src/ui/features/common'
import { XYZ } from '../../../../src/utils/helpers'
import { axisValues } from './helpers/axis-values'
import { getNextScale } from './helpers/get-next-scale'
import { KeyframeProps } from './keyframe'
import { ScaleInput } from './scale-input'

interface ScaleKeyframeProps extends KeyframeProps {
  scaleAspectRatioLocked: boolean
  featureScaleAxis: XYZ[]
}

export function ScaleKeyframe(props: ScaleKeyframeProps) {
  const v = props.keyframe.value || [0, 0, 0]
  const [frame, setFrame] = useState<any>(props.keyframe.frame)
  const [x, setX] = useState<any>(truncate(v[0]))
  const [y, setY] = useState<any>(truncate(v[1]))
  const [z, setZ] = useState<any>(truncate(v[2]))
  const scaleValues = { x, y, z } as axisValues

  const previousValues = useRef<axisValues>({ ...scaleValues })

  useEffect(() => {
    props.setKeyframe(props.index, {
      frame: frame,
      value: [x, y, z],
    })
  }, [frame, x, y, z])

  const setScale = (axisChanged: XYZ) => (e: JSXInternal.TargetedEvent<HTMLInputElement>) => {
    const newState = getNextScale(axisChanged, props.scaleAspectRatioLocked, props.featureScaleAxis, scaleValues, previousValues.current, e.currentTarget.value)
    previousValues.current = { ...scaleValues }

    newState.hasOwnProperty('x') && setX(newState.x)
    newState.hasOwnProperty('y') && setY(newState.y)
    newState.hasOwnProperty('z') && setZ(newState.z)
  }

  return (
    <>
      <input type="number" step={0.25} title="frame" value={frame} onInput={(e) => setFrame(parseFloat(e.currentTarget.value))} />
      &raquo;&nbsp;
      {props.featureScaleAxis.map((axis: XYZ) => (
        <ScaleInput key={axis} value={scaleValues[axis]} axis={axis} setScale={setScale} />
      ))}
      <button onClick={() => props.removeKeyframe(props.index)}>&times;</button>
    </>
  )
}
