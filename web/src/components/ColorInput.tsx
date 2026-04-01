import { JSX } from 'preact'

type ColorInputProps = {
  color: string
  onColorSelect(color: string): void
  disabled?: boolean
  id?: string
}

export function ColorInput({ color, onColorSelect, disabled, id }: ColorInputProps): JSX.Element {
  return <input type="color" value={color} disabled={disabled} id={id ?? ''} onInputCapture={(e) => onColorSelect((e.target as HTMLInputElement).value)} />
}
