// PickrComponent.tsx
import { useEffect, useRef } from 'preact/hooks'
import { h } from 'preact'
import Pickr from '@simonwep/pickr'

const swatches = [
  'rgba(244, 67, 54, 1)',
  'rgba(233, 30, 99, 1)',
  'rgba(156, 39, 176, 1)',
  'rgba(103, 58, 183, 1)',
  'rgba(63, 81, 181, 1)',
  'rgba(33, 150, 243, 1)',
  'rgba(3, 169, 244, 1)',
  'rgba(0, 188, 212, 1)',
  'rgba(0, 150, 136, 1)',
  'rgba(76, 175, 80, 1)',
  'rgba(139, 195, 74, 1)',
  'rgba(205, 220, 57, 1)',
  'rgba(255, 235, 59, 1)',
  'rgba(255, 193, 7, 1)',
]

let pickr: Pickr | null = null

export function ColorPicker({ value, onChange, className = '', theme = 'nano' }: { value: string; onChange: (color: string) => void; className?: string; theme?: 'nano' | 'classic' }) {
  const elRef = useRef<HTMLDivElement>(null)
  const pickrRef = useRef<any>(null)

  const onClick = () => {
    if (!elRef.current) {
      return
    }

    console.log('pickr', pickr)
    console.log('elRef', elRef.current)

    pickr = Pickr.create({
      el: elRef.current,
      theme,
      default: value,
      swatches,
      useAsButton: true,
      components: {
        preview: true,
        opacity: true,
        hue: true,
        interaction: {
          hex: true,
          rgba: true,
          hsla: true,
          hsva: true,
          cmyk: true,
          input: true,
          clear: true,
          save: true,
        },
      },
    })

    pickr.show()

    pickr.on('change', (color: any) => {
      const rgba = color.toRGBA().toString(3) // e.g., "rgba(255, 0, 0, 1)"
      onChange?.(rgba)
    })
  }

  useEffect(() => {
    return () => {
      pickr?.destroyAndRemove()
    }
  }, [])

  return <div ref={elRef} onClick={onClick} style={{ backgroundColor: value }} />
}
