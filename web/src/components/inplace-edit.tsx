import { useState } from 'preact/hooks'
import { Spinner } from '../spinner'

type Props = {
  value: string
  onChange: (value: string) => Promise<void>
  children: any
}

export function InplaceEdit({ value, onChange, children }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const [submitting, setSubmitting] = useState(false)

  const onClick = (e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setEditing(true)
    }
  }

  const onSave = async () => {
    setEditing(false)
    setSubmitting(true)

    await onChange(text)
    setSubmitting(false)
  }

  const onKeyPress = async (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave()
    }

    if (e.key === 'Escape') {
      setText(value)
      setEditing(false)
    }
  }

  const onBlur = async () => {
    onSave()
  }

  if (submitting) {
    return <Spinner />
  }

  if (editing) {
    return <input type="text" autofocus value={text} onKeyPress={onKeyPress} onBlur={onBlur} onChange={(e: any) => setText(e.target.value)} />
  }

  return (
    <span onMouseDown={onClick} class="inplace-edit">
      {children}
    </span>
  )
}
