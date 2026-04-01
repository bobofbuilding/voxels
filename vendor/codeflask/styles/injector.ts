export function injectCss (css: string, styleName: string|null, parental: HTMLElement) {
  const CSS_ID = styleName || 'codeflask-style'
  const parent = parental || document.head as HTMLElement

  if (!css) {
    return false
  }

  if (document.getElementById(CSS_ID)) {
    return true
  }

  const style = document.createElement('style')

  style.innerHTML = css
  style.id = CSS_ID
  parent.appendChild(style)

  return true
}
