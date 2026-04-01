import { JSXInternal } from 'preact/src/jsx'
import { Dispatch, StateUpdater, useEffect, useState } from 'preact/hooks'
import { JSX } from 'preact'

export const vectorField = (title: string, n: number, isValid: boolean, onInput: (e: JSX.TargetedEvent<HTMLInputElement, Event>) => void, onKeyUp: (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => void) => {
  return <input className={'number' + (!isValid ? ' error' : '')} type="text" title={title} value={n} onInput={onInput} onKeyUp={onKeyUp} />
}

type VectorProps = {
  title?: string
  value: number
  setter: Dispatch<StateUpdater<number>>
  errorMessage: (err: string | undefined) => void
  step: number
  convert?: (n: number) => number
  unconvert?: (n: number) => number
  limiter?: (x: number) => number
}

export function VectorField(props: VectorProps): JSXInternal.Element {
  type Valid = { value: any; ok: boolean }
  const [n, setN] = useState<Valid>({
    value: props.convert ? props.convert(props.value) : props.value,
    ok: true,
  })

  // make sure to update the state if the prop is changing
  useEffect(() => {
    const v = props.convert ? props.convert(props.value) : props.value
    // Don't overwrite local state if it ends with "." and represents the same numeric value
    // This preserves the decimal point while the user is typing
    if (typeof n.value === 'string' && n.value.endsWith('.') && Number(n.value) === v) {
      return
    }
    setN({ value: v, ok: true })
  }, [props.value])

  const setState = (val: any, errorMessage?: string) => {
    setN({ value: val, ok: !errorMessage })
    props.errorMessage(errorMessage)
    if (!errorMessage) {
      // Always convert to number for parent, even if local display keeps "3."
      const numericValue = Number(val)
      props.unconvert ? props.setter(props.unconvert(numericValue)) : props.setter(numericValue)
    }
  }

  // I will pretend I never wrote this, but it's figure out much precision the step has
  const precision = Math.max((props.step % 1).toString().length - 2, 0)

  const stepUp = (value: number, step: number) => {
    const multiplier = 1.0 / step
    const val = Math.floor(value * multiplier) / multiplier + step
    return (Math.round(val * multiplier) / multiplier).toFixed(precision)
  }

  const stepDown = (value: number, step: number) => {
    const multiplier = 1.0 / step
    const val = Math.ceil(value * multiplier) / multiplier - step
    return (Math.round(val * multiplier) / multiplier).toFixed(precision)
  }

  const isValid = (value: any) => {
    if (value === '') {
      setState('', `${props.title} must have a value`)
      return false
    }
    const num = Number(value)
    if (isNaN(num)) {
      setState(value, `${props.title} has a invalid numeric value`)
      return false
    }
    if (props.limiter && props.limiter(num) !== num) {
      setState(value, `${props.title} has a too high or low value`)
      return false
    }
    return true
  }

  const onKeyUp: (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => void = (e) => {
    if (!isValid(e.currentTarget.value)) return

    const num = Number(e.currentTarget.value)
    if (e.code === 'ArrowUp') setState(stepUp(num, props.step))
    else if (e.code === 'ArrowDown') setState(stepDown(num, props.step))
  }

  const onInput: (e: JSX.TargetedEvent<HTMLInputElement, Event>) => void = (e) => {
    const val = e.currentTarget.value.replace(/,/g, '.')
    if (isValid(val)) setState(val)
  }

  const onClickHandler = (signedStep: number) => {
    return () => {
      if (!isValid(n.value)) return
      const sign = Math.sign(signedStep)
      const step = Math.abs(signedStep)
      if (sign > 0) {
        setState(stepUp(n.value, step))
      } else if (sign < 0) {
        setState(stepDown(n.value, step))
      }
    }
  }

  const className = 'number' + (!n.ok ? ' error' : '')
  return (
    <>
      <span onClick={onClickHandler(-props.step)}>-</span>
      <input className={className} onInput={onInput} onKeyUp={onKeyUp} type="text" title={props.title} value={n.value} size={4} />
      <span onClick={onClickHandler(props.step)}>+</span>
    </>
  )
}
