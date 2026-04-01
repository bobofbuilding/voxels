module.exports = function html2canvas(element, context) {
  const range = document.createRange()
  const offset = element.getBoundingClientRect()

  function getRect(rect) {
    return {
      left: rect.left - offset.left - 0.5,
      top: rect.top - offset.top - 0.5,
      width: rect.width,
      height: rect.height
    }
  }

  function drawText(style, x, y, width, string, el) {
    context.font = 'bold ' + style.fontSize + ' ' + style.fontFamily
    context.textBaseline = 'top'
    context.fillStyle = style.color

    let a = 0
    let b = 0

    // Manual word wrapping
    const words = string.split(/\s+/)

    let es = window.getComputedStyle(el)
    let lineHeight = parseFloat(es.getPropertyValue('line-height'))

    let word = words.shift()

    width += 5

    while (word) {
      // Don't add space after last word
      if (words.length > 0) {
        word += ' '
      }

      context.font = style.fontWeight + ' ' + (parseInt(style.fontSize, 10)) + 'px' + ' ' + style.fontFamily

      const metrics = context.measureText(word)

      a += metrics.width

      if (a > width) {
        a = metrics.width
        b += lineHeight
      }

      context.fillText(word, (x + a - metrics.width), (y + b))

      word = words.shift()
    }
  }

  function drawBorder(style, which, x, y, width, height) {
    const borderWidth = style[which + 'Width']
    const borderStyle = style[which + 'Style']
    const borderColor = style[which + 'Color']

    if (borderWidth !== '0px' && borderStyle !== 'none') {
      context.strokeStyle = borderColor
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + width, y + height)
      context.stroke()
    }
  }

  function drawElement(element, style) {
    let rect

    if (element.nodeName === 'STYLE') {
      return
    }

    if (element.nodeType === 3) {
      // text

      range.selectNode(element)

      rect = getRect(range.getBoundingClientRect())

      drawText(style, rect.left, rect.top, rect.width, element.nodeValue.trim(), element.parentNode)
    } else {
      rect = getRect(element.getBoundingClientRect())
      style = window.getComputedStyle(element)

      context.fillStyle = style.backgroundColor
      context.fillRect(rect.left, rect.top, rect.width, rect.height)

      drawBorder(style, 'borderTop', rect.left, rect.top, rect.width, 0)
      drawBorder(style, 'borderLeft', rect.left, rect.top, 0, rect.height)
      drawBorder(style, 'borderBottom', rect.left, rect.top + rect.height, rect.width, 0)
      drawBorder(style, 'borderRight', rect.left + rect.width, rect.top, 0, rect.height)

      if (element.type === 'color' || element.type === 'text') {
        drawText(style, rect.left + parseInt(style.paddingLeft), rect.top + parseInt(style.paddingTop), rect.width, element.value, element)
      }
    }

    /*
    // debug
    context.strokeStyle = '#' + Math.random().toString( 16 ).slice( - 3 );
    context.strokeRect( rect.left - 0.5, rect.top - 0.5, rect.width + 1, rect.height + 1 );
    */

    for (let i = 0; i < element.childNodes.length; i++) {
      drawElement(element.childNodes[i], style)
    }
  }


  drawElement(element)
}
