import { JSXInternal } from 'preact/src/jsx'

type Props = {
  children: any
  onSubmit?: JSXInternal.GenericEventHandler<HTMLFormElement>
}

export function Form(props: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        props.onSubmit?.(e)
      }}
    >
      {props.children}
    </form>
  )
}
