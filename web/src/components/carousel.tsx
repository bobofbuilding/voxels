import { useLayoutEffect, useRef, useState } from 'preact/hooks'

export default function Carousel(props: { children: any; className?: string; callBack?: () => void }) {
  const carouselElement = useRef<HTMLDivElement>(null!)
  const [scrolled, setValue] = useState(0)

  const scrollLeft = () => {
    const slider = carouselElement.current
    if (!slider) return
    const isAtStart = slider.scrollWidth - slider.scrollLeft === 0
    slider.scrollTo({ top: 0, left: isAtStart ? 0 : slider.scrollLeft - slider.clientWidth, behavior: 'smooth' })
  }

  const remainingWidth = (slider: HTMLDivElement): number => slider.scrollWidth - slider.scrollLeft - slider.clientWidth

  const scrollRight = () => {
    const slider = carouselElement.current
    if (!slider) return
    if (remainingWidth(slider) <= slider.clientWidth) {
      // Wait for the scroll-animation to finish. 1500ms for btn-click
      setTimeout((slider) => props.callBack && slider.scrollLeft && (setValue(slider.scrollLeft), props.callBack()), 1500, slider)
    }
    const left = slider.scrollLeft + slider.clientWidth
    slider.scrollTo({ top: 0, left, behavior: 'smooth' })
  }

  const fingerSwipe = () => {
    // Wait for the scroll-animation to finish. 1500ms for finger-swipe
    setTimeout(() => {
      const slider = carouselElement.current
      if (slider && props.callBack && remainingWidth(slider) <= slider.clientWidth) {
        slider.scrollLeft && props.callBack()
      }
    }, 1500)
  }

  useLayoutEffect(() => {
    carouselElement.current?.scrollTo({ left: scrolled })
  })

  return (
    <div className={`Carousel ${props.className}`}>
      <label onClick={() => scrollLeft()}>{'<'}</label>
      <div ref={carouselElement} key={props.children?.length} onTouchEnd={fingerSwipe}>
        {props.children}
      </div>
      <label onClick={() => scrollRight()}>{'>'}</label>
    </div>
  )
}
