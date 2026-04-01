type Props = {
  label: string
  disabled?: boolean
}

export function Submit(props: Props) {
  return (
    <div class="f">
      <button disabled={props.disabled}>{props.label}</button>
    </div>
  )
}
