export function onDragStart(e: any) {
  const el = e.target.closest('dialog')

  var offsetX = e.clientX - el.offsetLeft
  var offsetY = e.clientY - el.offsetTop

  function listener(e: MouseEvent) {
    el.style.left = `${e.clientX - offsetX}px`
    el.style.top = `${e.clientY - offsetY}px`
  }

  document.addEventListener('mousemove', listener)

  document.addEventListener('mouseup', () => {
    document.removeEventListener('mousemove', listener)
  })

  document.addEventListener('mouseleave', () => {
    document.removeEventListener('mousemove', listener)
  })
}
