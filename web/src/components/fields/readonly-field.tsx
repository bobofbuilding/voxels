import { useId } from 'preact/compat'
import { ComponentChild, VNode } from 'preact'

type Props = {
  label?: string
  children?: ComponentChild[] | VNode<any> | null
}

export function ReadonlyField(props: Props) {
  const id = useId()
  return (
    <div class="f">
      <label htmlFor={id}>{props.label}</label>
      {props.children}
    </div>
  )
}
