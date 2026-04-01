import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { parseDateToYYYMMDD } from '../utils'

// Shamelessly copied and re-written for typescript from https://codesandbox.io/s/multi-range-slider-react-js-ecwcr?from-embed=&file=/src/App.js

export default function MultiRangeSlider(props: { min: number; defaultMin?: number; max: number; onChange: (dict: any) => void; className?: string }) {
  const { min, max, defaultMin, onChange, className } = props
  const [minVal, setMinVal] = useState<number>(defaultMin || min)
  const [maxVal, setMaxVal] = useState<number>(max)
  const minValRef = useRef<number>(defaultMin || min)
  const maxValRef = useRef<number>(max)
  const range = useRef<HTMLDivElement>(null)

  // Convert to percentage
  const getPercent = useCallback((value: number) => Math.round(((value - min) / (max - min)) * 100), [min, max])

  // Set width of the range to decrease from the left side
  useEffect(() => {
    const minP = getPercent(minVal)
    const minPercent = minP < 0 ? 0 : minP
    const maxPercent = getPercent(maxValRef.current)

    if (range.current) {
      range.current.style.left = `${minPercent}%`
      range.current.style.width = `${maxPercent - minPercent}%`
    }
  }, [minVal, getPercent])

  // Set width of the range to decrease from the right side
  useEffect(() => {
    const minP = getPercent(minValRef.current)
    const minPercent = minP < 0 ? 0 : minP
    const maxPercent = getPercent(maxVal)

    if (range.current) {
      range.current.style.width = `${maxPercent - minPercent}%`
    }
  }, [maxVal, getPercent])

  // Get min and max values when their state changes
  // useEffect(() => {
  //   onChange({ min: minVal, max: maxVal })
  // }, [minVal, maxVal, onChange])

  return (
    <div className={`MultiRangeSlider ${!!className && className}`}>
      <input
        type="range"
        min={min}
        max={max}
        value={minVal}
        onChange={(e: any) => {
          const value = Math.min(Number(e.target['value']), maxVal - 1)
          setMinVal(value)
          minValRef.current = value
        }}
        onChangeCapture={(e: any) => {
          const value = Math.min(Number(e.target['value']), maxVal - 1)
          if (value != min) {
            onChange({ min: minVal, max: maxVal })
          }
        }}
        style={{ zIndex: minVal > max - 100 ? '5' : null! }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={maxVal}
        onChange={(e: any) => {
          const value = Math.max(Number(e.target.value), minVal + 1)
          setMaxVal(value)
          maxValRef.current = value
        }}
        onChangeCapture={(e: any) => {
          const value = Math.max(Number(e.target.value), minVal + 1)
          if (value != max) {
            onChange({ min: minVal, max: maxVal })
          }
        }}
      />

      <div>
        <div />
        <div ref={range} />
        <div>{parseDateToYYYMMDD(new Date(minVal * 1000))}</div>
        <div>{parseDateToYYYMMDD(new Date(maxVal * 1000))}</div>
      </div>
    </div>
  )
}
