import { JSXInternal } from 'preact/src/jsx'

type ScaleInputProps = {
  value: number
  axis: any
  setScale: (v: any) => JSXInternal.GenericEventHandler<any>
}

export function ScaleInput(props: ScaleInputProps) {
  return <input type="number" key={props.axis} step={0.1} title={props.axis} value={props.value} onInput={props.setScale(props.axis)} onChange={props.setScale(props.axis)} />
}
