import { useEffect, useState } from 'preact/hooks'
import { AnimationDestination, KeyFrame } from '../../../../common/messages/feature'
import { degToRad, noConversion, numericFieldHandler, radToDeg, truncate, xyzFields } from '../../../../src/ui/features/common'

export interface KeyframeProps {
  keyframe: KeyFrame
  setKeyframe: (index: number, value: KeyFrame) => void
  removeKeyframe: (index: number) => void
  index: number
  destination: AnimationDestination
}

// used for rotation and position
export function Keyframe(props: KeyframeProps) {
  const v = props.keyframe.value || [0, 0, 0]

  const [frame, setFrame] = useState<number>(Number(props.keyframe.frame))
  const [x, setX] = useState<number>(truncate(v[0] || 0))
  const [y, setY] = useState<number>(truncate(v[1] || 0))
  const [z, setZ] = useState<number>(truncate(v[2] || 0))

  useEffect(() => {
    props.setKeyframe(props.index, {
      frame: frame,
      value: [x, y, z],
    })
  }, [frame, x, y, z])

  let step, convert, unconvert

  if (props.destination === 'rotation') {
    step = 10
    // Values are edited as degrees, saved as radians
    convert = radToDeg
    unconvert = degToRad
  } else {
    step = 0.25
    // Values are edited as they are saved, identity conversion function
    convert = unconvert = noConversion
  }
  return (
    <>
      <input name="frameI" type="number" step={1} title="frame" value={frame} onInput={numericFieldHandler(setFrame, 0)} />
      &raquo;&nbsp;
      {xyzFields(x, y, z, setX, setY, setZ, step, convert, unconvert)}
      <button onClick={() => props.removeKeyframe(props.index)}>&times;</button>
    </>
  )
}
