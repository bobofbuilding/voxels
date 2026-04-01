import { ComponentProps } from 'preact'

export const Separator = (
  props: ComponentProps<'div'> & {
    type?: 'vertical' | 'horizontal'
    text?: string
  },
) => {
  const { className, type = 'horizontal', ...rest } = props

  if (props.type === 'horizontal') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }} class={className} {...rest}>
        <div style={{ height: '1px', width: '50px', backgroundColor: '#ccc' }}></div>
        <span style={{ padding: '0 0.5rem', fontSize: '0.9rem', color: '#666' }}>{props.text}</span>
        <div style={{ height: '1px', width: '50px', backgroundColor: '#ccc' }}></div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} class={className} {...rest}>
      <div style={{ height: '50px', width: '1px', backgroundColor: '#ccc' }}></div>
      <span style={{ padding: '0.5rem 0', fontSize: '0.9rem', color: '#666' }}>{props.text}</span>
      <div style={{ height: '50px', width: '1px', backgroundColor: '#ccc' }}></div>
    </div>
  )
}
